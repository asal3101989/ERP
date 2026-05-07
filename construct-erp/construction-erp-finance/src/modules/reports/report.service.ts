// ============================================================
// src/modules/reports/report.service.ts
// Finance analytics: MIS, dashboards, GST reports, TDS reports
// ============================================================
import { prisma } from '../../lib/prisma';
import { LedgerService } from '../ledger/ledger.service';

const ledger = new LedgerService();

export class ReportService {
  /**
   * Finance Dashboard KPIs — used by the React dashboard.
   */
  async getDashboardKPIs(fiscalYear?: number) {
    const year = fiscalYear || new Date().getFullYear();
    const yearStart = new Date(year, 3, 1);  // Indian FY: Apr 1
    const yearEnd = new Date(year + 1, 2, 31);

    const [revenue, expenses, pendingAP, pendingAR, cashBalance, overduePO] = await Promise.all([
      // Total billed revenue (AR)
      prisma.invoice.aggregate({
        where: { type: 'CLIENT_INVOICE', status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
          invoiceDate: { gte: yearStart, lte: yearEnd } },
        _sum: { grandTotal: true },
      }),
      // Total vendor expenses (AP)
      prisma.invoice.aggregate({
        where: { type: 'VENDOR_INVOICE', status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
          invoiceDate: { gte: yearStart, lte: yearEnd } },
        _sum: { grandTotal: true },
      }),
      // Pending payables
      prisma.invoice.aggregate({
        where: { type: 'VENDOR_INVOICE', status: { in: ['APPROVED', 'PARTIALLY_PAID'] }, balanceDue: { gt: 0 } },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Pending receivables
      prisma.invoice.aggregate({
        where: { type: 'CLIENT_INVOICE', status: { in: ['APPROVED', 'PARTIALLY_PAID'] }, balanceDue: { gt: 0 } },
        _sum: { balanceDue: true },
        _count: true,
      }),
      // Cash (placeholder — would come from bank reconciliation)
      Promise.resolve({ total: 0 }),
      // Overdue invoices
      prisma.invoice.count({
        where: { status: { in: ['APPROVED', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } },
      }),
    ]);

    const totalRevenue = Number(revenue._sum.grandTotal || 0);
    const totalExpenses = Number(expenses._sum.grandTotal || 0);

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      grossProfit: totalRevenue - totalExpenses,
      grossMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0',
      pendingAP: { amount: Number(pendingAP._sum.balanceDue || 0), count: pendingAP._count },
      pendingAR: { amount: Number(pendingAR._sum.balanceDue || 0), count: pendingAR._count },
      overdueInvoices: overduePO,
      fiscalYear: year,
    };
  }

  /**
   * Monthly revenue vs expense chart data.
   */
  async getMonthlyTrend(year: number) {
    const months = Array.from({ length: 12 }, (_, i) => i);
    const data = await Promise.all(
      months.map(async (month) => {
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0);
        const [rev, exp] = await Promise.all([
          prisma.invoice.aggregate({
            where: { type: 'CLIENT_INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] },
              invoiceDate: { gte: from, lte: to } },
            _sum: { grandTotal: true },
          }),
          prisma.invoice.aggregate({
            where: { type: 'VENDOR_INVOICE', status: { notIn: ['DRAFT', 'CANCELLED'] },
              invoiceDate: { gte: from, lte: to } },
            _sum: { grandTotal: true },
          }),
        ]);
        return {
          month: from.toLocaleString('default', { month: 'short' }),
          revenue: Number(rev._sum.grandTotal || 0),
          expenses: Number(exp._sum.grandTotal || 0),
        };
      })
    );
    return data;
  }

  /**
   * Project-wise cost vs budget comparison.
   */
  async getProjectCostAnalysis() {
    const projects = await prisma.project.findMany({
      where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
      include: {
        budgets: {
          where: { status: 'APPROVED' },
          include: { lineItems: true },
        },
        _count: { select: { invoices: true } },
      },
    });

    return projects.map((p) => {
      const budget = p.budgets[0];
      const totalBudget = budget ? Number(budget.totalBudget) : 0;
      const totalActual = budget
        ? budget.lineItems.reduce((s, l) => s + Number(l.actualAmount), 0)
        : 0;
      return {
        projectCode: p.projectCode,
        name: p.name,
        contractValue: Number(p.contractValue),
        budget: totalBudget,
        actual: totalActual,
        variance: totalBudget - totalActual,
        utilization: totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : '0',
        status: p.status,
        invoiceCount: p._count.invoices,
      };
    });
  }

  /**
   * GSTR-2A data — Input tax credit eligible invoices.
   */
  async getGSTR2AData(period: string) {
    const entries = await prisma.gSTEntry.findMany({
      where: { gstrPeriod: period, isItcEligible: true, invoice: { type: 'VENDOR_INVOICE' } },
      include: {
        invoice: {
          include: { vendor: { select: { name: true, gstin: true } } },
        },
      },
    });

    const summary = { cgst: 0, sgst: 0, igst: 0, totalItc: 0 };
    for (const e of entries) {
      if (e.type === 'CGST') summary.cgst += Number(e.taxAmount);
      else if (e.type === 'SGST') summary.sgst += Number(e.taxAmount);
      else if (e.type === 'IGST') summary.igst += Number(e.taxAmount);
      summary.totalItc += Number(e.taxAmount);
    }

    return { period, entries, summary };
  }

  /**
   * TDS quarterly report (Form 26Q data).
   */
  async getTDSReport(quarterPeriod: string) {
    const entries = await prisma.tDSEntry.findMany({
      where: { quarterPeriod },
      include: { vendor: { select: { name: true, panNumber: true } } },
    });

    const bySection: Record<string, any> = {};
    for (const e of entries) {
      if (!bySection[e.section]) {
        bySection[e.section] = { section: e.section, totalBase: 0, totalTds: 0, count: 0 };
      }
      bySection[e.section].totalBase += Number(e.baseAmount);
      bySection[e.section].totalTds += Number(e.totalTds);
      bySection[e.section].count++;
    }

    return { quarterPeriod, entries, summary: Object.values(bySection) };
  }

  /**
   * Outstanding AR report — client-wise receivables.
   */
  async getOutstandingAR() {
    return prisma.invoice.findMany({
      where: { type: 'CLIENT_INVOICE', status: { in: ['APPROVED', 'PARTIALLY_PAID'] }, balanceDue: { gt: 0 } },
      include: {
        client: { select: { name: true, clientCode: true } },
        project: { select: { name: true, projectCode: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Cash flow forecast — next 90 days.
   */
  async getCashFlowForecast(days = 90) {
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + days);

    const [inflows, outflows] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          type: 'CLIENT_INVOICE',
          status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
          dueDate: { lte: toDate },
        },
        select: { dueDate: true, balanceDue: true, project: { select: { name: true } } },
      }),
      prisma.invoice.findMany({
        where: {
          type: 'VENDOR_INVOICE',
          status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
          dueDate: { lte: toDate },
        },
        select: { dueDate: true, balanceDue: true, vendor: { select: { name: true } } },
      }),
    ]);

    return {
      expectedInflows: inflows.map((i) => ({
        date: i.dueDate,
        amount: Number(i.balanceDue),
        source: i.project?.name,
      })),
      expectedOutflows: outflows.map((i) => ({
        date: i.dueDate,
        amount: Number(i.balanceDue),
        source: (i as any).vendor?.name,
      })),
      netCashFlow:
        inflows.reduce((s, i) => s + Number(i.balanceDue), 0) -
        outflows.reduce((s, i) => s + Number(i.balanceDue), 0),
    };
  }
}
