// ============================================================
// src/modules/ledger/ledger.routes.ts
// Manual journal entries + ledger queries
// ============================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize } from '../../middleware/auth.middleware';
import { LedgerService } from './ledger.service';

const ledger = new LedgerService();

const manualJESchema = z.object({
  description: z.string().min(3),
  entryDate: z.string().datetime(),
  projectId: z.string().uuid().optional(),
  lineItems: z.array(z.object({
    accountId: z.string().uuid(),
    isDebit: z.boolean(),
    amount: z.number().positive(),
    description: z.string().optional(),
  })).min(2),
});

const router = Router();

// Chart of Accounts
router.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await ledger.getChartOfAccounts()); } catch (err) { next(err); }
});

// Trial Balance
router.get('/trial-balance', authorize('ADMIN', 'ACCOUNTANT', 'AUDITOR'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate, projectId } = req.query;
    if (!fromDate || !toDate) { res.status(400).json({ error: 'fromDate and toDate required' }); return; }
    res.json(await ledger.getTrialBalance(new Date(fromDate as string), new Date(toDate as string), projectId as string));
  } catch (err) { next(err); }
});

// Journal entries list
router.get('/journal-entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, type, fromDate, toDate, page = '1', limit = '20' } = req.query as any;
    const where: any = {
      ...(projectId && { projectId }),
      ...(type && { type }),
      ...(fromDate && toDate && { entryDate: { gte: new Date(fromDate), lte: new Date(toDate) } }),
    };
    const { PrismaClient } = await import('@prisma/client');
    // Use direct prisma import
    const { prisma } = await import('../../lib/prisma');
    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lineItems: {
            include: {
              debitAccount: { select: { code: true, name: true } },
              creditAccount: { select: { code: true, name: true } },
            },
          },
          project: { select: { name: true, projectCode: true } },
          createdBy: { select: { fullName: true } },
        },
        orderBy: { entryDate: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.journalEntry.count({ where }),
    ]);
    res.json({ data: entries, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) { next(err); }
});

// Single journal entry
router.get('/journal-entries/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../lib/prisma');
    const entry = await prisma.journalEntry.findUnique({
      where: { id: req.params.id },
      include: {
        lineItems: {
          include: {
            debitAccount: true,
            creditAccount: true,
          },
        },
        createdBy: { select: { fullName: true } },
        project: { select: { name: true } },
      },
    });
    if (!entry) { res.status(404).json({ error: 'Journal entry not found' }); return; }
    res.json(entry);
  } catch (err) { next(err); }
});

// Create manual journal entry
router.post('/journal-entries', authorize('ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = manualJESchema.parse(req.body);
    const entry = await ledger.createManualJournalEntry(dto, req.user!.userId);
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// Post a manual journal entry
router.post('/journal-entries/:id/post', authorize('ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../../lib/prisma');
    const entry = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data: { isPosted: true, postingDate: new Date() },
    });
    res.json(entry);
  } catch (err) { next(err); }
});

// Project P&L
router.get('/project/:projectId/pl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) { res.status(400).json({ error: 'fromDate and toDate required' }); return; }
    res.json(await ledger.getProjectPL(req.params.projectId, new Date(fromDate as string), new Date(toDate as string)));
  } catch (err) { next(err); }
});

export default router;

// ============================================================
// src/modules/workflow/workflow.routes.ts
// Approval queue + workflow history
// ============================================================
import { Router as WFRouter, Request as WFRequest, Response as WFResponse, NextFunction as WFNext } from 'express';
import { WorkflowService } from './workflow.service';

const wf = new WorkflowService();
const workflowRouter = WFRouter();

// My pending approvals
workflowRouter.get('/my-approvals', async (req: WFRequest, res: WFResponse, next: WFNext) => {
  try {
    res.json(await wf.getPendingApprovalsForUser(req.user!.userId));
  } catch (err) { next(err); }
});

// Workflow history for an entity
workflowRouter.get('/:entityType/:entityId/history', async (req: WFRequest, res: WFResponse, next: WFNext) => {
  try {
    res.json(await wf.getWorkflowHistory(req.params.entityType, req.params.entityId));
  } catch (err) { next(err); }
});

// Escalation check (admin trigger)
workflowRouter.post('/check-escalations', async (req: WFRequest, res: WFResponse, next: WFNext) => {
  try {
    res.json(await wf.checkEscalations());
  } catch (err) { next(err); }
});

export { workflowRouter };
