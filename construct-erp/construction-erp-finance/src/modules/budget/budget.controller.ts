// ============================================================
// src/modules/budget/budget.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { BudgetService } from './budget.service';

const service = new BudgetService();

export const createBudget = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.createBudget(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const listBudgets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listBudgets(req.query.projectId as string);
    res.json(result);
  } catch (err) { next(err); }
};

export const getBudgetSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getBudgetSummary(req.params.projectId);
    res.json(result);
  } catch (err) { next(err); }
};

export const approveBudget = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.approveBudget(req.params.id, req.user!.userId, req.body.comments);
    res.json(result);
  } catch (err) { next(err); }
};

export const reviseBudget = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.reviseBudget(req.params.id, req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
};
