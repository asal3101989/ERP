// ============================================================
// src/modules/budget/budget.routes.ts
// ============================================================
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createBudgetSchema, budgetRevisionSchema } from './budget.dto';
import * as ctrl from './budget.controller';

const router = Router();

router.get('/', ctrl.listBudgets);
router.get('/project/:projectId/summary', ctrl.getBudgetSummary);
router.post('/', authorize('ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER'), validate(createBudgetSchema), ctrl.createBudget);
router.post('/:id/approve', authorize('ADMIN', 'ACCOUNTANT'), ctrl.approveBudget);
router.post('/:id/revise', authorize('ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER'), validate(budgetRevisionSchema), ctrl.reviseBudget);

export default router;
