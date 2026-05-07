// ============================================================
// src/modules/payments/payment.dto.ts
// ============================================================
import { z } from 'zod';

export const createPaymentSchema = z.object({
  paymentDate: z.string().datetime(),
  paymentMode: z.enum(['NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'CASH', 'UPI', 'BANK_TRANSFER']),
  bankAccountId: z.string().uuid().optional(),
  ourBankAccount: z.string().optional(),
  transactionRef: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().datetime().optional(),
  bankName: z.string().optional(),
  remarks: z.string().optional(),
  allocations: z.array(z.object({
    invoiceId: z.string().uuid(),
    amount: z.number().positive(),
  })).min(1),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type PaymentFilters = {
  page?: number; limit?: number;
  type?: string; status?: string;
  fromDate?: string; toDate?: string;
};

// ============================================================
// src/modules/payments/payment.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { PaymentService } from './payment.service';

const service = new PaymentService();

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.createPayment(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const getPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getPaymentOrThrow(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

export const listPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listPayments(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
};

export const confirmPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.confirmPayment(req.params.id, req.body.transactionRef, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
};

export const reversePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.reversePayment(req.params.id, req.body.reason, req.user!.userId);
    res.json({ message: 'Payment reversed successfully' });
  } catch (err) { next(err); }
};

export const getAPAging = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getAPAgingReport();
    res.json(result);
  } catch (err) { next(err); }
};

// ============================================================
// src/modules/payments/payment.routes.ts
// ============================================================
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createPaymentSchema } from './payment.dto';
import * as ctrl from './payment.controller';

const router = Router();

router.get('/', ctrl.listPayments);
router.get('/ap-aging', ctrl.getAPAging);
router.get('/:id', ctrl.getPayment);
router.post('/', authorize('ADMIN', 'ACCOUNTANT'), validate(createPaymentSchema), ctrl.createPayment);
router.post('/:id/confirm', authorize('ADMIN', 'ACCOUNTANT'), ctrl.confirmPayment);
router.post('/:id/reverse', authorize('ADMIN'), ctrl.reversePayment);

export default router;
