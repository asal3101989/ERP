// ============================================================
// src/modules/invoices/invoice.service.ts
// Core business logic for AP/AR invoices
// ============================================================
import { Prisma, InvoiceStatus, InvoiceType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError, ConflictError, BusinessRuleError, ValidationError } from '../../lib/errors';
import { generateDocumentNumber } from '../../lib/number-sequences';
import { auditLog } from '../../lib/audit';
import { LedgerService } from '../ledger/ledger.service';
import { BudgetService } from '../budget/budget.service';
import { WorkflowService } from '../workflow/workflow.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceFilters } from './invoice.dto';

export class InvoiceService {
  private ledgerService = new LedgerService();
  private budgetService = new BudgetService();
  private workflowService = new WorkflowService();
  private notificationService = new NotificationService();

  /**
   * Create a new invoice (AP or AR).
   * Runs duplicate detection, budget validation, and initiates workflow.
   */
  async createInvoice(dto: CreateInvoiceDto, createdById: string): Promise<any> {
    // ── Step 1: Duplicate invoice detection (for AP)
    if (dto.type === 'VENDOR_INVOICE' && dto.externalInvoiceNo) {
      await this.checkDuplicateInvoice(dto.externalInvoiceNo, dto.vendorId!);
    }

    // ── Step 2: Validate vendor/client exists and is active
    if (dto.vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor || !vendor.isActive) throw new NotFoundError('Vendor', dto.vendorId);
      if (vendor.blacklisted) throw new BusinessRuleError('Vendor is blacklisted and cannot receive invoices');
    }

    if (dto.clientId) {
      const client = await prisma.client.findUnique({ where: { id: dto.clientId } });
      if (!client || !client.isActive) throw new NotFoundError('Client', dto.clientId);
    }

    // ── Step 3: Validate PO linkage for AP invoices
    if (dto.poId) {
      await this.validatePOLinkage(dto.poId, dto.grandTotal);
    }

    // ── Step 4: Calculate tax amounts
    const taxCalc = this.calculateTaxAmounts(dto.lineItems, dto.vendorId ? 'VENDOR' : 'CLIENT');

    // ── Step 5: Budget limit check for AP invoices
    if (dto.projectId && dto.type === 'VENDOR_INVOICE') {
      await this.budgetService.checkBudgetAvailability(
        dto.projectId,
        dto.costHead || 'MATERIAL',
        taxCalc.grandTotal
      );
    }

    // ── Step 6: Create invoice in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateDocumentNumber('INVOICE');

      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          externalInvoiceNo: dto.externalInvoiceNo,
          type: dto.type as InvoiceType,
          status: InvoiceStatus.DRAFT,
          projectId: dto.projectId,
          vendorId: dto.vendorId,
          clientId: dto.clientId,
          poId: dto.poId,
          milestoneId: dto.milestoneId,
          invoiceDate: new Date(dto.invoiceDate),
          dueDate: new Date(dto.dueDate),
          subTotal: taxCalc.subTotal,
          discountAmount: dto.discountAmount || 0,
          taxableAmount: taxCalc.taxableAmount,
          cgstAmount: taxCalc.cgst,
          sgstAmount: taxCalc.sgst,
          igstAmount: taxCalc.igst,
          totalGst: taxCalc.totalGst,
          tdsAmount: taxCalc.tdsAmount,
          tdsSection: dto.tdsSection || 'NOT_APPLICABLE',
          tdsRate: dto.tdsRate || 0,
          grandTotal: taxCalc.grandTotal,
          balanceDue: taxCalc.grandTotal,
          retentionAmount: dto.retentionAmount || 0,
          retentionPct: dto.retentionPct || 0,
          narration: dto.narration,
          createdById,
          lineItems: {
            create: dto.lineItems.map((item, idx) => ({
              ...item,
              lineNo: idx + 1,
              lineTotal: this.calculateLineTotal(item),
            })),
          },
        },
        include: {
          lineItems: true,
          vendor: { select: { name: true, vendorCode: true } },
          client: { select: { name: true, clientCode: true } },
          project: { select: { name: true, projectCode: true } },
        },
      });

      // Create GST entries
      await this.createGSTEntries(tx, created.id, dto.lineItems, dto.vendorId ? 'INTRA_STATE' : 'INTRA_STATE');

      // Create TDS entry if applicable
      if (taxCalc.tdsAmount > 0) {
        await tx.tDSEntry.create({
          data: {
            invoiceId: created.id,
            vendorId: dto.vendorId,
            section: dto.tdsSection as any || 'SEC_194C',
            baseAmount: taxCalc.taxableAmount,
            rate: dto.tdsRate || 2,
            tdsAmount: taxCalc.tdsAmount,
            totalTds: taxCalc.tdsAmount,
            deductionDate: new Date(dto.invoiceDate),
          },
        });
      }

      return created;
    });

    // ── Step 7: Link GRNs (3-way match) if provided
    if (dto.grnIds?.length) {
      await this.linkGRNsToInvoice(invoice.id, dto.grnIds, createdById);
    }

    auditLog({
      userId: createdById,
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: invoice.id,
      newValues: { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal },
    });

    return invoice;
  }

  /**
   * Submit invoice for approval — transitions DRAFT → PENDING_APPROVAL_L1
   */
  async submitForApproval(invoiceId: string, userId: string): Promise<any> {
    const invoice = await this.getInvoiceOrThrow(invoiceId);

    if (invoice.status !== 'DRAFT') {
      throw new BusinessRuleError(`Invoice is ${invoice.status}. Only DRAFT invoices can be submitted.`);
    }

    // Validate 3-way match for PO-linked AP invoices
    if (invoice.poId && invoice.type === 'VENDOR_INVOICE') {
      await this.validateThreeWayMatch(invoice);
    }

    return this.workflowService.transitionStatus(
      'INVOICE',
      invoiceId,
      'DRAFT',
      'PENDING_APPROVAL_L1',
      'SUBMIT',
      userId,
      'Submitted for approval'
    );
  }

  /**
   * Approve invoice at current level.
   * Multi-level: L1 → L2 → L3 → APPROVED based on amount thresholds.
   */
  async approveInvoice(invoiceId: string, approverId: string, comments?: string): Promise<any> {
    const invoice = await this.getInvoiceOrThrow(invoiceId);
    const currentLevel = this.extractLevel(invoice.status);

    if (!currentLevel) {
      throw new BusinessRuleError('Invoice is not in an approval state');
    }

    // Verify approver has authority for this level and amount
    const rule = await prisma.approvalRule.findFirst({
      where: {
        entityType: 'INVOICE',
        level: currentLevel,
        approverId,
        isActive: true,
        minAmount: { lte: invoice.grandTotal as any },
        OR: [
          { maxAmount: null },
          { maxAmount: { gte: invoice.grandTotal as any } },
        ],
      },
    });

    if (!rule) {
      throw new AppError('You are not authorized to approve this invoice at this level', 403, 'APPROVAL_DENIED');
    }

    // Determine next status
    const nextStatus = await this.getNextApprovalStatus(
      invoice.grandTotal as number,
      currentLevel
    );

    const updated = await this.workflowService.transitionStatus(
      'INVOICE',
      invoiceId,
      invoice.status,
      nextStatus,
      'APPROVE',
      approverId,
      comments
    );

    // If fully approved, post to GL
    if (nextStatus === 'APPROVED') {
      await this.postToGeneralLedger(invoice);
      await this.updateBudgetActuals(invoice);
      await this.notificationService.sendInvoiceApprovedNotification(invoice);
    } else {
      // Notify next-level approver
      await this.notificationService.sendApprovalRequestNotification(invoice, currentLevel + 1);
    }

    return updated;
  }

  /**
   * Reject invoice — sends back to submitter with reason.
   */
  async rejectInvoice(invoiceId: string, approverId: string, reason: string): Promise<any> {
    if (!reason?.trim()) throw new ValidationError('Rejection reason is required');

    const invoice = await this.getInvoiceOrThrow(invoiceId);

    if (!invoice.status.startsWith('PENDING_APPROVAL')) {
      throw new BusinessRuleError('Invoice is not pending approval');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'REJECTED', rejectionReason: reason },
      });
      await this.workflowService.logAction(tx, 'INVOICE', invoiceId, 'REJECT',
        invoice.status, 'REJECTED', approverId, reason);
      return inv;
    });

    await this.notificationService.sendInvoiceRejectedNotification(invoice, reason);
    return updated;
  }

  /**
   * 3-Way Match Validation: PO ↔ GRN ↔ Invoice
   * Checks that quantities and amounts are consistent.
   */
  private async validateThreeWayMatch(invoice: any): Promise<void> {
    if (!invoice.grnLinks?.length) {
      throw new BusinessRuleError(
        'PO-linked invoices require at least one GRN to be linked (3-way match)'
      );
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: invoice.poId },
      include: { lineItems: true },
    });

    if (!po) throw new NotFoundError('PurchaseOrder', invoice.poId);

    // Check invoice amount ≤ PO amount + 5% tolerance
    const tolerance = Number(po.grandTotal) * 1.05;
    if (Number(invoice.grandTotal) > tolerance) {
      throw new BusinessRuleError(
        `Invoice amount (₹${invoice.grandTotal}) exceeds PO amount (₹${po.grandTotal}) by more than 5% tolerance`
      );
    }
  }

  /**
   * Prevent duplicate invoice entry.
   * Checks external invoice number + vendor combination.
   */
  private async checkDuplicateInvoice(externalInvoiceNo: string, vendorId: string): Promise<void> {
    const existing = await prisma.invoice.findFirst({
      where: {
        externalInvoiceNo,
        vendorId,
        status: { not: 'CANCELLED' },
      },
    });

    if (existing) {
      throw new ConflictError(
        `Duplicate invoice detected. Invoice ${externalInvoiceNo} from this vendor already exists (${existing.invoiceNumber})`
      );
    }
  }

  /**
   * Calculate GST amounts for line items.
   * Handles CGST+SGST (intra-state) vs IGST (inter-state).
   */
  private calculateTaxAmounts(lineItems: any[], type: string) {
    let subTotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let tdsAmount = 0;

    for (const item of lineItems) {
      const amount = Number(item.quantity) * Number(item.unitRate);
      subTotal += amount;

      if (item.gstType === 'IGST') {
        totalIgst += (amount * Number(item.gstRate)) / 100;
      } else if (item.gstType !== 'EXEMPT') {
        const halfRate = Number(item.gstRate) / 2;
        totalCgst += (amount * halfRate) / 100;
        totalSgst += (amount * halfRate) / 100;
      }
    }

    const taxableAmount = subTotal;
    const totalGst = totalCgst + totalSgst + totalIgst;
    const grandTotal = taxableAmount + totalGst;

    return {
      subTotal,
      taxableAmount,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst,
      tdsAmount,
      grandTotal,
    };
  }

  private calculateLineTotal(item: any): number {
    const base = Number(item.quantity) * Number(item.unitRate);
    const gst = item.gstType === 'IGST'
      ? (base * Number(item.gstRate)) / 100
      : (base * Number(item.gstRate)) / 100;
    return base + gst;
  }

  private async createGSTEntries(tx: any, invoiceId: string, lineItems: any[], supplyType: string): Promise<void> {
    const entries = lineItems.map(item => ({
      invoiceId,
      type: item.gstType || 'CGST',
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      taxableValue: Number(item.quantity) * Number(item.unitRate),
      rate: item.gstRate || 0,
      taxAmount: ((Number(item.quantity) * Number(item.unitRate)) * (item.gstRate || 0)) / 100,
      supplyType,
      gstrPeriod: new Date().toISOString().slice(0, 7),
      isItcEligible: true,
    }));
    await tx.gSTEntry.createMany({ data: entries });
  }

  /**
   * Auto-post approved AP/AR invoices to General Ledger.
   * AP: Dr. Expense/Asset, Cr. Accounts Payable
   * AR: Dr. Accounts Receivable, Cr. Revenue
   */
  private async postToGeneralLedger(invoice: any): Promise<void> {
    await this.ledgerService.createAutoJournalEntry({
      referenceType: 'INVOICE',
      referenceId: invoice.id,
      description: `Auto-entry: ${invoice.type} ${invoice.invoiceNumber}`,
      entryDate: invoice.invoiceDate || new Date(),
      projectId: invoice.projectId,
      invoiceType: invoice.type,
      grandTotal: Number(invoice.grandTotal),
      tdsAmount: Number(invoice.tdsAmount),
      gstAmount: Number(invoice.totalGst),
    });
  }

  private async updateBudgetActuals(invoice: any): Promise<void> {
    if (invoice.projectId && invoice.type === 'VENDOR_INVOICE') {
      for (const item of invoice.lineItems || []) {
        if (item.costHead) {
          await this.budgetService.updateActualCost(
            invoice.projectId,
            item.costHead,
            Number(item.lineTotal)
          );
        }
      }
    }
  }

  private async validatePOLinkage(poId: string, amount: number): Promise<void> {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundError('PurchaseOrder', poId);
    if (po.status === 'CLOSED') throw new BusinessRuleError('PO is closed and cannot accept new invoices');
  }

  private extractLevel(status: string): number | null {
    const match = status.match(/PENDING_APPROVAL_L(\d)/);
    return match ? parseInt(match[1]) : null;
  }

  private async getNextApprovalStatus(amount: number, currentLevel: number): Promise<string> {
    // Check if there's a higher-level approver needed
    const nextLevelRule = await prisma.approvalRule.findFirst({
      where: {
        entityType: 'INVOICE',
        level: currentLevel + 1,
        isActive: true,
        minAmount: { lte: amount },
        OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }],
      },
    });

    return nextLevelRule ? `PENDING_APPROVAL_L${currentLevel + 1}` : 'APPROVED';
  }

  private async linkGRNsToInvoice(invoiceId: string, grnIds: string[], userId: string): Promise<void> {
    await prisma.invoiceGRNLink.createMany({
      data: grnIds.map(grnId => ({ invoiceId, grnId, matchedBy: userId })),
      skipDuplicates: true,
    });
  }

  async getInvoiceOrThrow(id: string): Promise<any> {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        vendor: true,
        client: true,
        project: true,
        grnLinks: { include: { grn: true } },
        payments: { include: { payment: true } },
        workflowLogs: { include: { user: { select: { fullName: true } } }, orderBy: { performedAt: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice', id);
    return invoice;
  }

  async listInvoices(filters: InvoiceFilters, userId: string) {
    const { page = 1, limit = 20, type, status, projectId, vendorId, clientId, fromDate, toDate } = filters;

    const where: Prisma.InvoiceWhereInput = {
      ...(type && { type: type as InvoiceType }),
      ...(status && { status: status as InvoiceStatus }),
      ...(projectId && { projectId }),
      ...(vendorId && { vendorId }),
      ...(clientId && { clientId }),
      ...(fromDate && toDate && {
        invoiceDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          vendor: { select: { name: true, vendorCode: true } },
          client: { select: { name: true, clientCode: true } },
          project: { select: { name: true, projectCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOutstandingAP(asOfDate?: Date) {
    return prisma.invoice.findMany({
      where: {
        type: 'VENDOR_INVOICE',
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
        ...(asOfDate && { dueDate: { lte: asOfDate } }),
      },
      include: { vendor: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getOutstandingAR() {
    return prisma.invoice.findMany({
      where: {
        type: 'CLIENT_INVOICE',
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: { client: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }
}
