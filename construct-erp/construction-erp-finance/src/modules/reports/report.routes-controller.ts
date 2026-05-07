// ============================================================
// src/modules/reports/report.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { ReportService } from './report.service';
import { LedgerService } from '../ledger/ledger.service';

const reportService = new ReportService();
const ledgerService = new LedgerService();

export const getDashboardKPIs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.getDashboardKPIs(
      req.query.fiscalYear ? Number(req.query.fiscalYear) : undefined
    );
    res.json(result);
  } catch (err) { next(err); }
};

export const getMonthlyTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const result = await reportService.getMonthlyTrend(year);
    res.json(result);
  } catch (err) { next(err); }
};

export const getProjectCostAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.getProjectCostAnalysis();
    res.json(result);
  } catch (err) { next(err); }
};

export const getTrialBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate, projectId } = req.query;
    const result = await ledgerService.getTrialBalance(
      new Date(fromDate as string),
      new Date(toDate as string),
      projectId as string | undefined
    );
    res.json(result);
  } catch (err) { next(err); }
};

export const getProjectPL = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.query;
    const result = await ledgerService.getProjectPL(
      req.params.projectId,
      new Date(fromDate as string),
      new Date(toDate as string)
    );
    res.json(result);
  } catch (err) { next(err); }
};

export const getGSTR2A = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.getGSTR2AData(req.params.period);
    res.json(result);
  } catch (err) { next(err); }
};

export const getTDSReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.getTDSReport(req.params.quarter);
    res.json(result);
  } catch (err) { next(err); }
};

export const getCashFlowForecast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reportService.getCashFlowForecast(Number(req.query.days || 90));
    res.json(result);
  } catch (err) { next(err); }
};

export const getChartOfAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ledgerService.getChartOfAccounts();
    res.json(result);
  } catch (err) { next(err); }
};

// ============================================================
// src/modules/reports/report.routes.ts
// ============================================================
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';
import * as ctrl from './report.controller';

const router = Router();

router.get('/dashboard', ctrl.getDashboardKPIs);
router.get('/monthly-trend', ctrl.getMonthlyTrend);
router.get('/project-cost-analysis', ctrl.getProjectCostAnalysis);
router.get('/trial-balance', authorize('ADMIN', 'ACCOUNTANT', 'AUDITOR'), ctrl.getTrialBalance);
router.get('/project/:projectId/pl', ctrl.getProjectPL);
router.get('/gst/gstr2a/:period', authorize('ADMIN', 'ACCOUNTANT'), ctrl.getGSTR2A);
router.get('/tds/:quarter', authorize('ADMIN', 'ACCOUNTANT'), ctrl.getTDSReport);
router.get('/cashflow/forecast', ctrl.getCashFlowForecast);
router.get('/chart-of-accounts', ctrl.getChartOfAccounts);

export default router;
