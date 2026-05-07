// ============================================================
// src/modules/budget/budget.dto.ts
// ============================================================
import { z } from 'zod';

const budgetLineItemSchema = z.object({
  costHead: z.enum(['MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OVERHEAD', 'CONTINGENCY']),
  description: z.string().min(1).max(500),
  plannedAmount: z.number().positive(),
  boqReference: z.string().optional(),
});

export const createBudgetSchema = z.object({
  projectId: z.string().uuid(),
  fiscalYear: z.number().int().optional(),
  description: z.string().optional(),
  lineItems: z.array(budgetLineItemSchema).min(1),
});

export const budgetRevisionSchema = z.object({
  revisionType: z.enum(['SCOPE_CHANGE', 'VARIATION_ORDER', 'REALLOCATION', 'ESCALATION']),
  reason: z.string().min(10),
  description: z.string().optional(),
  lineItems: z.array(budgetLineItemSchema).min(1),
});

export type CreateBudgetDto = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetDto = Partial<CreateBudgetDto>;
export type BudgetRevisionDto = z.infer<typeof budgetRevisionSchema>;
