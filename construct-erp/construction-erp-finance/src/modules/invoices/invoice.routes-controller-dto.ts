// ============================================================
// src/modules/invoices/invoice.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from './invoice.service';

const service = new InvoiceService();

export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.createInvoice(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getInvoiceOrThrow(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

export const listInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listInvoices(req.query as any, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
};

export const submitForApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.submitForApproval(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
};

export const approveInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.approveInvoice(req.params.id, req.user!.userId, req.body.comments);
    res.json(result);
  } catch (err) { next(err); }
};

export const rejectInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(422).json({ error: 'Rejection reason is required' });
      return;
    }
    const result = await service.rejectInvoice(req.params.id, req.user!.userId, reason);
    res.json(result);
  } catch (err) { next(err); }
};

export const getOutstandingAP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : undefined;
    const result = await service.getOutstandingAP(asOfDate);
    res.json(result);
  } catch (err) { next(err); }
};

export const getOutstandingAR = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getOutstandingAR();
    res.json(result);
  } catch (err) { next(err); }
};

// ============================================================
// src/modules/invoices/invoice.dto.ts
// ============================================================
import { z } from 'zod';

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  unitRate: z.number().positive(),
  gstType: z.enum(['CGST', 'SGST', 'IGST', 'EXEMPT']).optional(),
  gstRate: z.number().min(0).max(28).optional(),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  costHead: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OVERHEAD', 'CONTINGENCY']).optional(),
});

export const createInvoiceSchema = z.object({
  type: z.enum(['VENDOR_INVOICE', 'CLIENT_INVOICE', 'PROFORMA', 'CREDIT_NOTE', 'DEBIT_NOTE']),
  projectId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  poId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  externalInvoiceNo: z.string().optional(),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  narration: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  retentionAmount: z.number().min(0).optional(),
  retentionPct: z.number().min(0).max(100).optional(),
  tdsSection: z.string().optional(),
  tdsRate: z.number().min(0).optional(),
  grnIds: z.array(z.string().uuid()).optional(),
  lineItems: z.array(lineItemSchema).min(1),
  grandTotal: z.number().positive(),
}).refine((d) => d.vendorId || d.clientId, {
  message: 'Either vendorId or clientId must be provided',
});

export const invoiceFiltersSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  projectId: z.string().optional(),
  vendorId: z.string().optional(),
  clientId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;

// ============================================================
// src/modules/invoices/invoice.routes.ts
// ============================================================
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createInvoiceSchema, invoiceFiltersSchema } from './invoice.dto';
import * as ctrl from './invoice.controller';

const router = Router();

// List & search
router.get('/', validate(invoiceFiltersSchema, 'query'), ctrl.listInvoices);
router.get('/outstanding/ap', ctrl.getOutstandingAP);
router.get('/outstanding/ar', ctrl.getOutstandingAR);
router.get('/:id', ctrl.getInvoice);

// Create (Accountant or PM can create)
router.post('/', authorize('ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER'), validate(createInvoiceSchema), ctrl.createInvoice);

// Workflow
router.post('/:id/submit', ctrl.submitForApproval);
router.post('/:id/approve', authorize('ADMIN', 'ACCOUNTANT'), ctrl.approveInvoice);
router.post('/:id/reject', authorize('ADMIN', 'ACCOUNTANT'), ctrl.rejectInvoice);

export default router;
