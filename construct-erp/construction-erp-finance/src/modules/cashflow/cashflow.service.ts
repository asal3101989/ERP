// ============================================================
// src/modules/cashflow/cashflow.service.ts
// Real-time cash position + 90-day rolling forecast
// ============================================================
import { prisma } from '../../lib/prisma';
import { auditLog } from '../../lib/audit';

export class CashFlowService {
  /**
   * Current cash position across all bank accounts.
   * In production: integrate with bank statement API.
   */
  async getCurrentPosition() {
    const [recentPayments, overdueReceivables, upcomingPayables] = await Promise.all([
      // Payments made/received last 30 days
      prisma.payment.findMany({
        where: {
          status: 'COMPLETED',
          paymentDate: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: { type: true, amount: true, paymentDate: true, ourBankAccount: true },
      }),
      // Overdue AR
      prisma.invoice.aggregate({
        where: {
          type: 'CLIENT_INVOICE',
          status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
          balanceDue: { gt: 0 },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // AP due next 30 days
      prisma.invoice.aggregate({
        where: {
          type: 'VENDOR_INVOICE',
          status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
          dueDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
          balanceDue: { gt: 0 },
        },
        _sum: { balanceDue: true },
        _count: true,
      }),
    ]);

    const inflows = recentPayments.filter(p => p.type === 'INCOMING').reduce((s, p) => s + Number(p.amount), 0);
    const outflows = recentPayments.filter(p => p.type === 'OUTGOING').reduce((s, p) => s + Number(p.amount), 0);

    return {
      netCash30Days: inflows - outflows,
      inflows30Days: inflows,
      outflows30Days: outflows,
      overdueAR: {
        amount: Number(overdueReceivables._sum.balanceDue || 0),
        count: overdueReceivables._count,
      },
      upcomingAP30Days: {
        amount: Number(upcomingPayables._sum.balanceDue || 0),
        count: upcomingPayables._count,
      },
    };
  }

  /**
   * Weekly cash flow forecast for the next N weeks.
   */
  async getWeeklyForecast(weeks = 12) {
    const today = new Date();
    const result = [];

    for (let w = 0; w < weeks; w++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const [inflows, outflows] = await Promise.all([
        prisma.invoice.aggregate({
          where: {
            type: 'CLIENT_INVOICE',
            status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
            dueDate: { gte: weekStart, lte: weekEnd },
          },
          _sum: { balanceDue: true },
        }),
        prisma.invoice.aggregate({
          where: {
            type: 'VENDOR_INVOICE',
            status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
            dueDate: { gte: weekStart, lte: weekEnd },
          },
          _sum: { balanceDue: true },
        }),
      ]);

      const inflow = Number(inflows._sum.balanceDue || 0);
      const outflow = Number(outflows._sum.balanceDue || 0);

      result.push({
        week: `W${w + 1}`,
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        inflow,
        outflow,
        net: inflow - outflow,
      });
    }

    // Add cumulative running balance
    let running = 0;
    for (const w of result) {
      running += w.net;
      (w as any).cumulativeNet = running;
    }

    return result;
  }

  /**
   * Project-wise cash flow performance.
   */
  async getProjectCashFlow(projectId: string) {
    const [billed, received, paid, committed] = await Promise.all([
      prisma.invoice.aggregate({
        where: { projectId, type: 'CLIENT_INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] } },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.aggregate({
        where: { projectId, type: 'CLIENT_INVOICE', status: { in: ['PARTIALLY_PAID', 'PAID'] } },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { projectId, type: 'VENDOR_INVOICE', status: { in: ['PARTIALLY_PAID', 'PAID'] } },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { projectId, type: 'VENDOR_INVOICE', status: { in: ['APPROVED', 'PARTIALLY_PAID'] } },
        _sum: { balanceDue: true },
      }),
    ]);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { contractValue: true, name: true, projectCode: true },
    });

    return {
      project,
      billedToClient: Number(billed._sum.grandTotal || 0),
      receivedFromClient: Number(received._sum.paidAmount || 0),
      paidToVendors: Number(paid._sum.paidAmount || 0),
      committedToVendors: Number(committed._sum.balanceDue || 0),
      netProjectCash:
        Number(received._sum.paidAmount || 0) - Number(paid._sum.paidAmount || 0),
      contractValue: Number(project?.contractValue || 0),
    };
  }

  /**
   * Cash flow statement (operating/investing/financing activities).
   * Simplified version for construction ERP.
   */
  async getCashFlowStatement(fromDate: Date, toDate: Date, projectId?: string) {
    const where: any = {
      status: 'COMPLETED',
      paymentDate: { gte: fromDate, lte: toDate },
      ...(projectId && {
        allocations: { some: { invoice: { projectId } } },
      }),
    };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        allocations: {
          include: {
            invoice: { select: { type: true, projectId: true } },
          },
        },
      },
    });

    const operating = {
      receipts: 0,
      payments: 0,
      net: 0,
    };

    for (const p of payments) {
      if (p.type === 'INCOMING') operating.receipts += Number(p.amount);
      else operating.payments += Number(p.amount);
    }
    operating.net = operating.receipts - operating.payments;

    return {
      period: { from: fromDate, to: toDate },
      operatingActivities: operating,
      investingActivities: { net: 0 }, // Plant, machinery purchases
      financingActivities: { net: 0 }, // Loan receipts/repayments
      netCashChange: operating.net,
    };
  }
}

// ============================================================
// src/modules/cashflow/cashflow.routes.ts + controller
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

const cashFlowService = new CashFlowService();
const cashflowRouter = Router();

cashflowRouter.get('/position', async (req, res, next) => {
  try { res.json(await cashFlowService.getCurrentPosition()); } catch (err) { next(err); }
});

cashflowRouter.get('/forecast/weekly', async (req, res, next) => {
  try {
    const weeks = Number(req.query.weeks) || 12;
    res.json(await cashFlowService.getWeeklyForecast(weeks));
  } catch (err) { next(err); }
});

cashflowRouter.get('/project/:projectId', async (req, res, next) => {
  try { res.json(await cashFlowService.getProjectCashFlow(req.params.projectId)); } catch (err) { next(err); }
});

cashflowRouter.get('/statement', async (req, res, next) => {
  try {
    const { fromDate, toDate, projectId } = req.query;
    res.json(await cashFlowService.getCashFlowStatement(
      new Date(fromDate as string),
      new Date(toDate as string),
      projectId as string | undefined
    ));
  } catch (err) { next(err); }
});

export default cashflowRouter;

// ============================================================
// src/modules/notifications/notification.service.ts
// In-app + email notifications for approvals, payments, alerts
// ============================================================
export class NotificationService {
  /**
   * Notify approver of pending invoice.
   */
  async sendApprovalRequestNotification(invoice: any, level: number): Promise<void> {
    // In production: find the L{level} approver and send email via nodemailer/SES
    // For now: log to console (replace with your SMTP/notification provider)
    console.log(
      `[NOTIFY] Approval request: Invoice ${invoice.invoiceNumber} ` +
      `₹${invoice.grandTotal} awaiting L${level} approval`
    );
    // TODO: prisma.notification.create({ data: { ... } })
    // TODO: sendEmail({ to: approver.email, subject: `Invoice ${invoice.invoiceNumber} pending L${level} approval`, ... })
  }

  async sendInvoiceApprovedNotification(invoice: any): Promise<void> {
    console.log(
      `[NOTIFY] Invoice ${invoice.invoiceNumber} approved. ` +
      `Amount: ₹${invoice.grandTotal}`
    );
  }

  async sendPaymentNotification(payment: any): Promise<void> {
    console.log(
      `[NOTIFY] Payment ${payment.paymentNumber} of ₹${payment.amount} ` +
      `via ${payment.paymentMode}`
    );
  }

  async sendBudgetAlertNotification(projectId: string, costHead: string, utilizationPct: number): Promise<void> {
    console.log(
      `[ALERT] Budget warning: Project ${projectId} | ${costHead} | ` +
      `${utilizationPct.toFixed(1)}% utilized`
    );
  }

  async sendOverdueInvoiceAlert(invoice: any): Promise<void> {
    console.log(
      `[ALERT] Overdue invoice: ${invoice.invoiceNumber} | ` +
      `Due: ${invoice.dueDate} | Balance: ₹${invoice.balanceDue}`
    );
  }
}
