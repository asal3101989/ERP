// ============================================================
// src/modules/payments/payment.service.ts
// Complete payment lifecycle: initiation → bank processing → GL posting
// ============================================================
import { prisma } from '../../lib/prisma';
import { NotFoundError, BusinessRuleError, ValidationError } from '../../lib/errors';
import { generateDocumentNumber } from '../../lib/number-sequences';
import { auditLog } from '../../lib/audit';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePaymentDto, PaymentFilters } from './payment.dto';
import { validateIFSC } from '../../lib/bank-validation';

export class PaymentService {
  private ledgerService = new LedgerService();

  /**
   * Initiate payment against one or more approved invoices.
   * Steps:
   *  1. Validate invoices are payable
   *  2. Validate bank account / IFSC
   *  3. Calculate TDS deduction
   *  4. Create payment + allocations
   *  5. Update invoice balances
   *  6. Post GL entries
   */
  async createPayment(dto: CreatePaymentDto, processedById: string) {
    // ── Validate all invoices
    const invoices = await Promise.all(
      dto.allocations.map((a) =>
        prisma.invoice.findUnique({
          where: { id: a.invoiceId },
          include: { vendor: true, client: true },
        })
      )
    );

    for (const inv of invoices) {
      if (!inv) throw new NotFoundError('Invoice');
      if (!['APPROVED', 'PARTIALLY_PAID'].includes(inv.status)) {
        throw new BusinessRuleError(
          `Invoice ${inv.invoiceNumber} is ${inv.status}. Only APPROVED or PARTIALLY_PAID invoices can be paid.`
        );
      }
    }

    // ── Validate IFSC for NEFT/RTGS
    if (['NEFT', 'RTGS', 'IMPS'].includes(dto.paymentMode) && dto.bankAccountId) {
      const bankAccount = await prisma.vendorBankAccount.findUnique({
        where: { id: dto.bankAccountId },
      });
      if (!bankAccount) throw new NotFoundError('Bank Account', dto.bankAccountId);

      const isValid = await validateIFSC(bankAccount.ifscCode);
      if (!isValid) throw new ValidationError(`Invalid IFSC code: ${bankAccount.ifscCode}`);
    }

    // ── Validate allocation amounts
    for (const alloc of dto.allocations) {
      const invoice = invoices.find((i) => i!.id === alloc.invoiceId)!;
      if (alloc.amount > Number(invoice.balanceDue)) {
        throw new BusinessRuleError(
          `Allocation ₹${alloc.amount} exceeds balance due ₹${invoice.balanceDue} for ${invoice.invoiceNumber}`
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const paymentNumber = await generateDocumentNumber('PAYMENT');
      const totalAmount = dto.allocations.reduce((s, a) => s + a.amount, 0);

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          type: invoices[0]!.vendorId ? 'OUTGOING' : 'INCOMING',
          status: 'PENDING',
          paymentMode: dto.paymentMode as any,
          paymentDate: new Date(dto.paymentDate),
          amount: totalAmount,
          bankAccountId: dto.bankAccountId,
          ourBankAccount: dto.ourBankAccount,
          transactionRef: dto.transactionRef,
          chequeNumber: dto.chequeNumber,
          chequeDate: dto.chequeDate ? new Date(dto.chequeDate) : null,
          bankName: dto.bankName,
          remarks: dto.remarks,
          processedById,
          allocations: {
            create: dto.allocations.map((a) => ({
              invoiceId: a.invoiceId,
              amount: a.amount,
            })),
          },
        },
        include: { allocations: { include: { invoice: true } } },
      });

      // ── Update invoice balances and statuses
      for (const alloc of dto.allocations) {
        const invoice = invoices.find((i) => i!.id === alloc.invoiceId)!;
        const newBalance = Number(invoice.balanceDue) - alloc.amount;
        const newStatus =
          newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: alloc.invoiceId },
          data: {
            balanceDue: Math.max(0, newBalance),
            paidAmount: { increment: alloc.amount },
            status: newStatus,
            ...(newBalance <= 0.01 && { paidAt: new Date() }),
          },
        });
      }

      return payment;
    }).then(async (payment) => {
      // ── Post to GL (outside transaction for flexibility)
      await this.postPaymentToGL(payment);

      auditLog({
        userId: processedById,
        action: 'CREATE',
        entityType: 'PAYMENT',
        entityId: payment.id,
        newValues: { paymentNumber: payment.paymentNumber, amount: payment.amount },
      });

      return payment;
    });
  }

  /**
   * Mark payment as completed — typically called via bank webhook or manual confirmation.
   */
  async confirmPayment(paymentId: string, transactionRef: string, userId: string) {
    const payment = await this.getPaymentOrThrow(paymentId);
    if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') {
      throw new BusinessRuleError(`Cannot confirm payment in ${payment.status} status`);
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'COMPLETED', transactionRef, approvedBy: userId, approvedAt: new Date() },
    });

    auditLog({
      userId,
      action: 'CONFIRM',
      entityType: 'PAYMENT',
      entityId: paymentId,
      newValues: { transactionRef },
    });

    return updated;
  }

  /**
   * Reverse a completed payment (rare — e.g., bounce/dishonour).
   * Re-opens the invoices to unpaid status.
   */
  async reversePayment(paymentId: string, reason: string, userId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { allocations: { include: { invoice: true } } },
    });

    if (!payment) throw new NotFoundError('Payment', paymentId);
    if (payment.status !== 'COMPLETED') {
      throw new BusinessRuleError('Only COMPLETED payments can be reversed');
    }

    return prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'REVERSED', failureReason: reason },
      });

      // Re-open invoices
      for (const alloc of payment.allocations) {
        await tx.invoice.update({
          where: { id: alloc.invoiceId },
          data: {
            balanceDue: { increment: Number(alloc.amount) },
            paidAmount: { decrement: Number(alloc.amount) },
            status: 'APPROVED',
            paidAt: null,
          },
        });
      }

      // Reverse GL entries
      await this.ledgerService.reverseJournalEntry(
        'PAYMENT',
        paymentId,
        `Payment reversal: ${reason}`,
        userId
      );

      auditLog({ userId, action: 'REVERSE', entityType: 'PAYMENT', entityId: paymentId });
    });
  }

  /**
   * Get aging report for AP (payables due).
   * Buckets: Current, 1-30, 31-60, 61-90, 90+
   */
  async getAPAgingReport() {
    const today = new Date();
    const invoices = await prisma.invoice.findMany({
      where: {
        type: 'VENDOR_INVOICE',
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: { vendor: { select: { name: true, vendorCode: true } } },
    });

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const byVendor: Record<string, any> = {};

    for (const inv of invoices) {
      const daysPastDue = Math.floor(
        (today.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const balance = Number(inv.balanceDue);

      if (daysPastDue <= 0) buckets.current += balance;
      else if (daysPastDue <= 30) buckets.days30 += balance;
      else if (daysPastDue <= 60) buckets.days60 += balance;
      else if (daysPastDue <= 90) buckets.days90 += balance;
      else buckets.over90 += balance;

      const vendorId = inv.vendorId!;
      if (!byVendor[vendorId]) {
        byVendor[vendorId] = {
          vendorName: inv.vendor?.name,
          vendorCode: inv.vendor?.vendorCode,
          current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0,
        };
      }
      const bucket = daysPastDue <= 0 ? 'current' : daysPastDue <= 30 ? 'days30' :
        daysPastDue <= 60 ? 'days60' : daysPastDue <= 90 ? 'days90' : 'over90';
      byVendor[vendorId][bucket] += balance;
      byVendor[vendorId].total += balance;
    }

    return { summary: buckets, byVendor: Object.values(byVendor) };
  }

  private async postPaymentToGL(payment: any) {
    await this.ledgerService.createAutoJournalEntry({
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      description: `Payment: ${payment.paymentNumber}`,
      entryDate: payment.paymentDate,
      invoiceType: payment.type === 'OUTGOING' ? 'VENDOR_INVOICE' : 'CLIENT_INVOICE',
      grandTotal: Number(payment.amount),
      tdsAmount: 0,
      gstAmount: 0,
    });
  }

  async getPaymentOrThrow(id: string) {
    const p = await prisma.payment.findUnique({
      where: { id },
      include: { allocations: { include: { invoice: true } } },
    });
    if (!p) throw new NotFoundError('Payment', id);
    return p;
  }

  async listPayments(filters: PaymentFilters) {
    const { page = 1, limit = 20, type, status, fromDate, toDate } = filters;
    const where: any = {
      ...(type && { type }),
      ...(status && { status }),
      ...(fromDate && toDate && {
        paymentDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          processedBy: { select: { fullName: true } },
          allocations: { include: { invoice: { select: { invoiceNumber: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return { data: payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
