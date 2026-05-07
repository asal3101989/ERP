// ============================================================
// src/modules/budget/budget.service.ts
// Project budgeting, cost tracking, variance alerts
// ============================================================
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError, BusinessRuleError, ConflictError } from '../../lib/errors';
import { generateDocumentNumber } from '../../lib/number-sequences';
import { auditLog } from '../../lib/audit';
import { CreateBudgetDto, UpdateBudgetDto, BudgetRevisionDto } from './budget.dto';

export class BudgetService {
  private readonly VARIANCE_ALERT_THRESHOLD = 0.9; // Alert when 90% utilized

  /**
   * Create a new project budget with line-item cost heads.
   * Only one APPROVED budget per project at a time.
   */
  async createBudget(dto: CreateBudgetDto, createdById: string) {
    // Check for existing active budget on this project
    const existing = await prisma.budget.findFirst({
      where: { projectId: dto.projectId, status: { in: ['DRAFT', 'APPROVED'] } },
    });
    if (existing) {
      throw new ConflictError(
        `Project already has an active budget (${existing.budgetNumber}). Revise it instead.`
      );
    }

    const project = await prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundError('Project', dto.projectId);

    return prisma.$transaction(async (tx) => {
      const budgetNumber = await generateDocumentNumber('BUDGET');
      const totalBudget = dto.lineItems.reduce((sum, i) => sum + Number(i.plannedAmount), 0);

      const budget = await tx.budget.create({
        data: {
          budgetNumber,
          projectId: dto.projectId,
          version: 1,
          status: 'DRAFT',
          totalBudget,
          fiscalYear: dto.fiscalYear || new Date().getFullYear(),
          description: dto.description,
          createdById,
          lineItems: {
            create: dto.lineItems.map((item) => ({
              costHead: item.costHead,
              description: item.description,
              plannedAmount: item.plannedAmount,
              actualAmount: 0,
              committedAmount: 0,
              varianceAmount: item.plannedAmount,
              utilizationPct: 0,
              boqReference: item.boqReference,
            })),
          },
        },
        include: { lineItems: true, project: { select: { name: true, projectCode: true } } },
      });

      auditLog({ userId: createdById, action: 'CREATE', entityType: 'BUDGET', entityId: budget.id });
      return budget;
    });
  }

  /**
   * Approve a budget — sets it as the active cost baseline.
   */
  async approveBudget(budgetId: string, approverId: string, comments?: string) {
    const budget = await this.getBudgetOrThrow(budgetId);
    if (budget.status !== 'DRAFT') {
      throw new BusinessRuleError(`Cannot approve budget in ${budget.status} status`);
    }

    const updated = await prisma.budget.update({
      where: { id: budgetId },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date() },
    });

    await prisma.budgetRevision.create({
      data: {
        budgetId,
        revisionType: 'APPROVAL',
        comments: comments || 'Budget approved',
        revisedById: approverId,
        newTotalBudget: budget.totalBudget,
      },
    });

    auditLog({ userId: approverId, action: 'APPROVE', entityType: 'BUDGET', entityId: budgetId });
    return updated;
  }

  /**
   * Create a budget revision (e.g., scope change, VO).
   * Increments version and archives old budget.
   */
  async reviseBudget(budgetId: string, dto: BudgetRevisionDto, revisedById: string) {
    const existing = await this.getBudgetOrThrow(budgetId);
    if (existing.status !== 'APPROVED') {
      throw new BusinessRuleError('Only APPROVED budgets can be revised');
    }

    return prisma.$transaction(async (tx) => {
      // Archive current budget
      await tx.budget.update({
        where: { id: budgetId },
        data: { status: 'SUPERSEDED' },
      });

      const budgetNumber = await generateDocumentNumber('BUDGET');
      const newTotal = dto.lineItems.reduce((sum, i) => sum + Number(i.plannedAmount), 0);

      // Create new version
      const revised = await tx.budget.create({
        data: {
          budgetNumber,
          projectId: existing.projectId,
          version: existing.version + 1,
          status: 'DRAFT',
          totalBudget: newTotal,
          fiscalYear: existing.fiscalYear,
          parentBudgetId: budgetId,
          description: dto.description,
          createdById: revisedById,
          lineItems: {
            create: dto.lineItems.map((item) => ({
              costHead: item.costHead,
              description: item.description,
              plannedAmount: item.plannedAmount,
              actualAmount: 0,
              committedAmount: 0,
              varianceAmount: item.plannedAmount,
              utilizationPct: 0,
            })),
          },
        },
        include: { lineItems: true },
      });

      // Log revision
      await tx.budgetRevision.create({
        data: {
          budgetId,
          newBudgetId: revised.id,
          revisionType: dto.revisionType,
          comments: dto.reason,
          oldTotalBudget: existing.totalBudget,
          newTotalBudget: newTotal,
          varianceAmount: newTotal - Number(existing.totalBudget),
          revisedById,
        },
      });

      return revised;
    });
  }

  /**
   * Real-time budget availability check — called before invoice posting.
   * Throws if committed + actual would exceed budget.
   */
  async checkBudgetAvailability(
    projectId: string,
    costHead: string,
    amount: number
  ): Promise<void> {
    const budgetLine = await prisma.budgetLineItem.findFirst({
      where: {
        budget: { projectId, status: 'APPROVED' },
        costHead: costHead as any,
      },
    });

    if (!budgetLine) return; // No budget configured — skip check

    const available =
      Number(budgetLine.plannedAmount) -
      Number(budgetLine.actualAmount) -
      Number(budgetLine.committedAmount);

    if (amount > available) {
      throw new BusinessRuleError(
        `Budget exceeded for ${costHead}. Available: ₹${available.toLocaleString('en-IN')}. ` +
          `Requested: ₹${amount.toLocaleString('en-IN')}`
      );
    }

    // Warn if utilization will exceed threshold
    const newUtilization =
      (Number(budgetLine.actualAmount) + amount) / Number(budgetLine.plannedAmount);
    if (newUtilization > this.VARIANCE_ALERT_THRESHOLD) {
      // In production: trigger notification to PM
      console.warn(
        `[BUDGET ALERT] ${costHead} utilization at ${(newUtilization * 100).toFixed(1)}%`
      );
    }
  }

  /**
   * Update actual cost when an invoice is approved.
   * Called by InvoiceService post-approval.
   */
  async updateActualCost(projectId: string, costHead: string, amount: number): Promise<void> {
    const budgetLine = await prisma.budgetLineItem.findFirst({
      where: { budget: { projectId, status: 'APPROVED' }, costHead: costHead as any },
    });

    if (!budgetLine) return;

    const newActual = Number(budgetLine.actualAmount) + amount;
    const utilizationPct = (newActual / Number(budgetLine.plannedAmount)) * 100;
    const varianceAmount = Number(budgetLine.plannedAmount) - newActual;

    await prisma.budgetLineItem.update({
      where: { id: budgetLine.id },
      data: { actualAmount: newActual, utilizationPct, varianceAmount },
    });
  }

  /**
   * Update committed amount when a PO is raised (before invoice).
   */
  async updateCommittedCost(projectId: string, costHead: string, amount: number): Promise<void> {
    const budgetLine = await prisma.budgetLineItem.findFirst({
      where: { budget: { projectId, status: 'APPROVED' }, costHead: costHead as any },
    });

    if (!budgetLine) return;

    await prisma.budgetLineItem.update({
      where: { id: budgetLine.id },
      data: { committedAmount: { increment: amount } },
    });
  }

  /**
   * Get project budget summary with variance analysis.
   */
  async getBudgetSummary(projectId: string) {
    const budget = await prisma.budget.findFirst({
      where: { projectId, status: 'APPROVED' },
      include: {
        lineItems: { orderBy: { costHead: 'asc' } },
        project: { select: { name: true, projectCode: true, contractValue: true } },
      },
    });

    if (!budget) throw new NotFoundError('Active budget for project', projectId);

    const summary = {
      budgetNumber: budget.budgetNumber,
      version: budget.version,
      totalBudget: Number(budget.totalBudget),
      totalActual: budget.lineItems.reduce((s, i) => s + Number(i.actualAmount), 0),
      totalCommitted: budget.lineItems.reduce((s, i) => s + Number(i.committedAmount), 0),
      totalVariance: 0,
      overallUtilization: 0,
      costHeads: budget.lineItems.map((item) => ({
        costHead: item.costHead,
        description: item.description,
        planned: Number(item.plannedAmount),
        actual: Number(item.actualAmount),
        committed: Number(item.committedAmount),
        available:
          Number(item.plannedAmount) - Number(item.actualAmount) - Number(item.committedAmount),
        variance: Number(item.varianceAmount),
        utilization: Number(item.utilizationPct),
        isOverBudget: Number(item.actualAmount) > Number(item.plannedAmount),
        isAtRisk: Number(item.utilizationPct) > 85,
      })),
      project: budget.project,
    };

    summary.totalVariance = summary.totalBudget - summary.totalActual;
    summary.overallUtilization = (summary.totalActual / summary.totalBudget) * 100;

    return summary;
  }

  async getBudgetOrThrow(id: string) {
    const b = await prisma.budget.findUnique({ where: { id }, include: { lineItems: true } });
    if (!b) throw new NotFoundError('Budget', id);
    return b;
  }

  async listBudgets(projectId?: string) {
    return prisma.budget.findMany({
      where: { ...(projectId && { projectId }) },
      include: {
        project: { select: { name: true, projectCode: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
