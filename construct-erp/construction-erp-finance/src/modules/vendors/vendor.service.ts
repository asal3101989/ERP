// ============================================================
// src/modules/vendors/vendor.service.ts
// Vendor master: onboarding, bank account management, performance
// ============================================================
import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../lib/errors';
import { validateGSTIN, validatePAN, validateIFSC } from '../../lib/bank-validation';
import { auditLog } from '../../lib/audit';

export class VendorService {
  async createVendor(dto: any, createdById: string) {
    const existing = await prisma.vendor.findFirst({
      where: { OR: [{ vendorCode: dto.vendorCode }, { gstin: dto.gstin }] },
    });
    if (existing) throw new ConflictError(`Vendor with code ${dto.vendorCode} or GSTIN ${dto.gstin} already exists`);

    if (dto.gstin && !validateGSTIN(dto.gstin)) {
      throw new BusinessRuleError(`Invalid GSTIN format: ${dto.gstin}`);
    }
    if (dto.panNumber && !validatePAN(dto.panNumber)) {
      throw new BusinessRuleError(`Invalid PAN format: ${dto.panNumber}`);
    }

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode: dto.vendorCode,
        name: dto.name,
        vendorType: dto.vendorType,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        gstin: dto.gstin,
        panNumber: dto.panNumber,
        msmeRegistration: dto.msmeRegistration,
        tdsApplicable: dto.tdsApplicable ?? true,
        tdsSection: dto.tdsSection || 'SEC_194C',
        paymentTerms: dto.paymentTerms || 30,
      },
      include: { bankAccounts: true },
    });

    auditLog({ userId: createdById, action: 'CREATE', entityType: 'VENDOR', entityId: vendor.id });
    return vendor;
  }

  async updateVendor(id: string, dto: any, updatedById: string) {
    await this.getVendorOrThrow(id);
    const updated = await prisma.vendor.update({
      where: { id },
      data: dto,
    });
    auditLog({ userId: updatedById, action: 'UPDATE', entityType: 'VENDOR', entityId: id });
    return updated;
  }

  async addBankAccount(vendorId: string, dto: any, userId: string) {
    await this.getVendorOrThrow(vendorId);

    if (!(await validateIFSC(dto.ifscCode))) {
      throw new BusinessRuleError(`Invalid IFSC code: ${dto.ifscCode}`);
    }

    // If this is set as primary, unset others
    if (dto.isPrimary) {
      await prisma.vendorBankAccount.updateMany({
        where: { vendorId },
        data: { isPrimary: false },
      });
    }

    const bankAccount = await prisma.vendorBankAccount.create({
      data: {
        vendorId,
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        ifscCode: dto.ifscCode.toUpperCase(),
        bankName: dto.bankName,
        branch: dto.branch,
        isPrimary: dto.isPrimary || false,
      },
    });

    auditLog({ userId, action: 'ADD_BANK_ACCOUNT', entityType: 'VENDOR', entityId: vendorId });
    return bankAccount;
  }

  async getVendorLedger(vendorId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { vendorId, type: 'VENDOR_INVOICE' },
      include: {
        payments: { include: { payment: true } },
        project: { select: { name: true, projectCode: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const totalBilled = invoices.reduce((s, i) => s + Number(i.grandTotal), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.balanceDue), 0);

    return { invoices, summary: { totalBilled, totalPaid, totalOutstanding } };
  }

  async getVendorPerformance(vendorId: string) {
    const [invoices, tdsEntries] = await Promise.all([
      prisma.invoice.findMany({
        where: { vendorId },
        select: { invoiceDate: true, dueDate: true, paidAt: true, grandTotal: true, status: true },
      }),
      prisma.tDSEntry.findMany({ where: { vendorId } }),
    ]);

    const paidOnTime = invoices.filter(i => i.paidAt && i.dueDate && i.paidAt <= i.dueDate).length;
    const totalPaid = invoices.filter(i => i.status === 'PAID').length;

    return {
      totalInvoices: invoices.length,
      totalValue: invoices.reduce((s, i) => s + Number(i.grandTotal), 0),
      paidOnTime,
      onTimePaymentRate: totalPaid > 0 ? ((paidOnTime / totalPaid) * 100).toFixed(1) : '0',
      totalTdsDeducted: tdsEntries.reduce((s, e) => s + Number(e.totalTds), 0),
    };
  }

  async blacklistVendor(vendorId: string, reason: string, userId: string) {
    const vendor = await this.getVendorOrThrow(vendorId);
    await prisma.vendor.update({ where: { id: vendorId }, data: { blacklisted: true, blacklistReason: reason } });
    auditLog({ userId, action: 'BLACKLIST_VENDOR', entityType: 'VENDOR', entityId: vendorId });
  }

  async listVendors(filters: { type?: string; search?: string; page?: number; limit?: number }) {
    const { type, search, page = 1, limit = 20 } = filters;
    const where: any = {
      ...(type && { vendorType: type }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { vendorCode: { contains: search, mode: 'insensitive' } },
          { gstin: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: { bankAccounts: { where: { isPrimary: true } }, _count: { select: { invoices: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    return { data: vendors, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getVendorOrThrow(id: string) {
    const v = await prisma.vendor.findUnique({ where: { id }, include: { bankAccounts: true } });
    if (!v) throw new NotFoundError('Vendor', id);
    return v;
  }
}

// ============================================================
// src/modules/vendors/vendor.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';

const vendorService = new VendorService();

export const createVendor = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await vendorService.createVendor(req.body, req.user!.userId)); }
  catch (err) { next(err); }
};

export const updateVendor = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await vendorService.updateVendor(req.params.id, req.body, req.user!.userId)); }
  catch (err) { next(err); }
};

export const getVendor = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await vendorService.getVendorOrThrow(req.params.id)); }
  catch (err) { next(err); }
};

export const listVendors = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await vendorService.listVendors(req.query as any)); }
  catch (err) { next(err); }
};

export const addBankAccount = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await vendorService.addBankAccount(req.params.id, req.body, req.user!.userId)); }
  catch (err) { next(err); }
};

export const getVendorLedger = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await vendorService.getVendorLedger(req.params.id)); }
  catch (err) { next(err); }
};

export const getVendorPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await vendorService.getVendorPerformance(req.params.id)); }
  catch (err) { next(err); }
};

export const blacklistVendor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    if (!reason) { res.status(400).json({ error: 'reason is required' }); return; }
    await vendorService.blacklistVendor(req.params.id, reason, req.user!.userId);
    res.json({ message: 'Vendor blacklisted' });
  } catch (err) { next(err); }
};

// ============================================================
// src/modules/vendors/vendor.routes.ts
// ============================================================
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';

const vendorRouter = Router();

vendorRouter.get('/', listVendors);
vendorRouter.get('/:id', getVendor);
vendorRouter.get('/:id/ledger', getVendorLedger);
vendorRouter.get('/:id/performance', getVendorPerformance);
vendorRouter.post('/', authorize('ADMIN', 'ACCOUNTANT', 'PROCUREMENT_OFFICER'), createVendor);
vendorRouter.put('/:id', authorize('ADMIN', 'ACCOUNTANT'), updateVendor);
vendorRouter.post('/:id/bank-accounts', authorize('ADMIN', 'ACCOUNTANT'), addBankAccount);
vendorRouter.post('/:id/blacklist', authorize('ADMIN'), blacklistVendor);

export default vendorRouter;
