// ============================================================
// src/modules/ledger/ledger.service.ts
// General Ledger: auto journal entries, trial balance, P&L, Balance Sheet
// ============================================================
import { prisma } from '../../lib/prisma';
import { NotFoundError, BusinessRuleError } from '../../lib/errors';
import { generateDocumentNumber } from '../../lib/number-sequences';
import { auditLog } from '../../lib/audit';

// ── System account codes (must exist in Chart of Accounts)
const SYSTEM_ACCOUNTS = {
  ACCOUNTS_PAYABLE: '2001',
  ACCOUNTS_RECEIVABLE: '1002',
  REVENUE: '4001',
  MATERIAL_EXPENSE: '5001',
  LABOR_EXPENSE: '5002',
  EQUIPMENT_EXPENSE: '5003',
  SUBCONTRACTOR_EXPENSE: '5004',
  OVERHEAD_EXPENSE: '5005',
  CASH_IN_HAND: '1001',
  BANK_ACCOUNT: '1010',
  TDS_PAYABLE: '2010',
  GST_INPUT: '1020',  // ITC
  GST_OUTPUT: '2020',
  SALARY_EXPENSE: '5010',
  PF_PAYABLE: '2011',
  ESI_PAYABLE: '2012',
};

interface AutoJournalParams {
  referenceType: string;
  referenceId: string;
  description: string;
  entryDate: Date;
  projectId?: string;
  invoiceType: string;
  grandTotal: number;
  tdsAmount: number;
  gstAmount: number;
}

export class LedgerService {
  /**
   * Auto-generate journal entries when invoices are approved.
   *
   * AP (Vendor Invoice):
   *   Dr. Expense Account        (grandTotal - GST)
   *   Dr. GST Input (ITC)        (gstAmount)
   *   Cr. TDS Payable            (tdsAmount)
   *   Cr. Accounts Payable       (grandTotal - tdsAmount)
   *
   * AR (Client Invoice):
   *   Dr. Accounts Receivable    (grandTotal)
   *   Cr. Revenue                (grandTotal - GST)
   *   Cr. GST Output             (gstAmount)
   */
  async createAutoJournalEntry(params: AutoJournalParams) {
    const { referenceType, referenceId, description, entryDate, projectId,
      invoiceType, grandTotal, tdsAmount, gstAmount } = params;

    // Check for duplicate — idempotency
    const existing = await prisma.journalEntry.findFirst({
      where: { referenceType, referenceId },
    });
    if (existing) return existing;

    const accounts = await this.resolveAccounts(SYSTEM_ACCOUNTS);
    const entryNumber = await generateDocumentNumber('JOURNAL');
    const now = new Date();
    const netAmount = grandTotal - tdsAmount;
    const baseAmount = grandTotal - gstAmount;

    const lineItems =
      invoiceType === 'VENDOR_INVOICE'
        ? this.buildAPLineItems(accounts, baseAmount, gstAmount, tdsAmount, grandTotal)
        : this.buildARLineItems(accounts, baseAmount, gstAmount, grandTotal);

    const totalDebit = lineItems.filter((l) => l.isDebit).reduce((s, l) => s + l.amount, 0);
    const totalCredit = lineItems.filter((l) => !l.isDebit).reduce((s, l) => s + l.amount, 0);

    // Safety check: debits must equal credits
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BusinessRuleError(
        `Journal entry imbalance: Dr ${totalDebit} ≠ Cr ${totalCredit} for ${referenceType} ${referenceId}`
      );
    }

    const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        type: referenceType === 'INVOICE'
          ? invoiceType === 'VENDOR_INVOICE' ? 'AUTO_AP' : 'AUTO_AR'
          : 'AUTO_PAYMENT',
        description,
        entryDate,
        postingDate: now,
        fiscalYear: entryDate.getFullYear(),
        fiscalPeriod: entryDate.getMonth() + 1,
        projectId,
        referenceType,
        referenceId,
        isPosted: true,
        totalDebit,
        totalCredit,
        createdById: systemUser!.id,
        lineItems: {
          create: lineItems.map((line, idx) => ({
            lineNo: idx + 1,
            description: line.description,
            debitAccountId: line.isDebit ? line.accountId : null,
            creditAccountId: !line.isDebit ? line.accountId : null,
            debitAmount: line.isDebit ? line.amount : 0,
            creditAmount: !line.isDebit ? line.amount : 0,
            projectId,
          })),
        },
      },
      include: { lineItems: true },
    });

    return entry;
  }

  /**
   * Reverse a journal entry (for payment reversals, credit notes).
   */
  async reverseJournalEntry(
    referenceType: string,
    referenceId: string,
    description: string,
    userId: string
  ) {
    const original = await prisma.journalEntry.findFirst({
      where: { referenceType, referenceId, isReversed: false },
      include: { lineItems: true },
    });
    if (!original) return;

    const entryNumber = await generateDocumentNumber('JOURNAL');
    const systemUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    const reversal = await prisma.journalEntry.create({
      data: {
        entryNumber,
        type: 'ADJUSTMENT',
        description: `REVERSAL: ${description}`,
        entryDate: new Date(),
        postingDate: new Date(),
        fiscalYear: new Date().getFullYear(),
        fiscalPeriod: new Date().getMonth() + 1,
        projectId: original.projectId,
        referenceType: 'REVERSAL',
        referenceId: original.id,
        isPosted: true,
        totalDebit: original.totalCredit,  // Swap
        totalCredit: original.totalDebit,
        createdById: systemUser!.id,
        lineItems: {
          create: original.lineItems.map((line, idx) => ({
            lineNo: idx + 1,
            description: `REVERSAL: ${line.description}`,
            // Swap debit/credit
            debitAccountId: line.creditAccountId,
            creditAccountId: line.debitAccountId,
            debitAmount: line.creditAmount,
            creditAmount: line.debitAmount,
            projectId: line.projectId,
          })),
        },
      },
    });

    await prisma.journalEntry.update({
      where: { id: original.id },
      data: { isReversed: true, reversalEntryId: reversal.id },
    });

    return reversal;
  }

  /**
   * Trial Balance — account-level debit/credit totals for a period.
   */
  async getTrialBalance(fromDate: Date, toDate: Date, projectId?: string) {
    const lineItems = await prisma.journalLineItem.findMany({
      where: {
        journalEntry: {
          isPosted: true,
          entryDate: { gte: fromDate, lte: toDate },
          ...(projectId && { projectId }),
        },
      },
      include: {
        debitAccount: { select: { code: true, name: true, type: true } },
        creditAccount: { select: { code: true, name: true, type: true } },
      },
    });

    const accountMap: Record<string, any> = {};

    for (const line of lineItems) {
      if (line.debitAccountId && line.debitAccount) {
        const key = line.debitAccountId;
        if (!accountMap[key]) {
          accountMap[key] = { ...line.debitAccount, debit: 0, credit: 0 };
        }
        accountMap[key].debit += Number(line.debitAmount);
      }
      if (line.creditAccountId && line.creditAccount) {
        const key = line.creditAccountId;
        if (!accountMap[key]) {
          accountMap[key] = { ...line.creditAccount, debit: 0, credit: 0 };
        }
        accountMap[key].credit += Number(line.creditAmount);
      }
    }

    const rows = Object.values(accountMap).sort((a, b) => a.code.localeCompare(b.code));
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  }

  /**
   * Project P&L — Revenue vs Cost breakdown.
   */
  async getProjectPL(projectId: string, fromDate: Date, toDate: Date) {
    const [revenues, expenses] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          projectId,
          type: 'CLIENT_INVOICE',
          status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
          invoiceDate: { gte: fromDate, lte: toDate },
        },
        _sum: { grandTotal: true },
      }),
      prisma.invoice.aggregate({
        where: {
          projectId,
          type: 'VENDOR_INVOICE',
          status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
          invoiceDate: { gte: fromDate, lte: toDate },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    const payroll = await prisma.payrollEntry.aggregate({
      where: {
        projectId,
        payPeriodFrom: { gte: fromDate },
        payPeriodTo: { lte: toDate },
      },
      _sum: { grossSalary: true },
    });

    const totalRevenue = Number(revenues._sum.grandTotal || 0);
    const totalExpense = Number(expenses._sum.grandTotal || 0);
    const totalPayroll = Number(payroll._sum.grossSalary || 0);
    const grossProfit = totalRevenue - totalExpense - totalPayroll;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Cost head breakdown
    const costByHead = await prisma.budgetLineItem.findMany({
      where: { budget: { projectId, status: 'APPROVED' } },
      select: { costHead: true, plannedAmount: true, actualAmount: true },
    });

    return {
      projectId,
      period: { from: fromDate, to: toDate },
      revenue: { total: totalRevenue },
      expenses: {
        vendor: totalExpense,
        payroll: totalPayroll,
        total: totalExpense + totalPayroll,
        byHead: costByHead,
      },
      grossProfit,
      grossMargin: grossMargin.toFixed(2),
    };
  }

  /**
   * Chart of Accounts — hierarchical listing.
   */
  async getChartOfAccounts() {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: { children: { where: { isActive: true } } },
    });
    return accounts.filter((a) => !a.parentId); // Return root accounts with children
  }

  async createManualJournalEntry(data: any, userId: string) {
    const { description, entryDate, projectId, lineItems } = data;

    const totalDebit = lineItems.reduce((s: number, l: any) => s + (l.isDebit ? l.amount : 0), 0);
    const totalCredit = lineItems.reduce((s: number, l: any) => s + (!l.isDebit ? l.amount : 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BusinessRuleError('Journal entry must balance: Total Debits must equal Total Credits');
    }

    const entryNumber = await generateDocumentNumber('JOURNAL');

    const entry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        type: 'MANUAL',
        description,
        entryDate: new Date(entryDate),
        postingDate: new Date(),
        fiscalYear: new Date(entryDate).getFullYear(),
        fiscalPeriod: new Date(entryDate).getMonth() + 1,
        projectId,
        isPosted: false, // Manual entries require review before posting
        totalDebit,
        totalCredit,
        createdById: userId,
        lineItems: {
          create: lineItems.map((line: any, idx: number) => ({
            lineNo: idx + 1,
            description: line.description,
            debitAccountId: line.isDebit ? line.accountId : null,
            creditAccountId: !line.isDebit ? line.accountId : null,
            debitAmount: line.isDebit ? line.amount : 0,
            creditAmount: !line.isDebit ? line.amount : 0,
          })),
        },
      },
    });

    auditLog({ userId, action: 'CREATE', entityType: 'JOURNAL_ENTRY', entityId: entry.id });
    return entry;
  }

  private buildAPLineItems(accounts: any, baseAmount: number, gstAmount: number, tdsAmount: number, grandTotal: number) {
    return [
      { accountId: accounts['5001'], amount: baseAmount, isDebit: true, description: 'Expense (net of GST)' },
      { accountId: accounts['1020'], amount: gstAmount, isDebit: true, description: 'GST Input Tax Credit' },
      { accountId: accounts['2010'], amount: tdsAmount, isDebit: false, description: 'TDS Payable' },
      { accountId: accounts['2001'], amount: grandTotal - tdsAmount, isDebit: false, description: 'Accounts Payable' },
    ];
  }

  private buildARLineItems(accounts: any, baseAmount: number, gstAmount: number, grandTotal: number) {
    return [
      { accountId: accounts['1002'], amount: grandTotal, isDebit: true, description: 'Accounts Receivable' },
      { accountId: accounts['4001'], amount: baseAmount, isDebit: false, description: 'Revenue' },
      { accountId: accounts['2020'], amount: gstAmount, isDebit: false, description: 'GST Output Tax' },
    ];
  }

  private async resolveAccounts(codes: Record<string, string>): Promise<Record<string, string>> {
    const accounts = await prisma.account.findMany({
      where: { code: { in: Object.values(codes) } },
      select: { id: true, code: true },
    });
    const map: Record<string, string> = {};
    for (const [key, code] of Object.entries(codes)) {
      const account = accounts.find((a) => a.code === code);
      if (account) map[code] = account.id;
    }
    return map;
  }
}
