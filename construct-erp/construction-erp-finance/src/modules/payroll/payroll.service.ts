// ============================================================
// src/modules/payroll/payroll.service.ts
// Monthly payroll processing with PF, ESI, TDS, bank transfer
// ============================================================
import { prisma } from '../../lib/prisma';
import { NotFoundError, BusinessRuleError, ConflictError } from '../../lib/errors';
import { generateDocumentNumber } from '../../lib/number-sequences';
import { auditLog } from '../../lib/audit';
import { LedgerService } from '../ledger/ledger.service';

// India statutory rates (FY2024-25)
const PF_RATE_EMPLOYEE = 0.12;   // 12%
const PF_RATE_EMPLOYER = 0.12;   // 12% (employer share)
const ESI_RATE_EMPLOYEE = 0.0075; // 0.75% (employees earning ≤ ₹21,000)
const ESI_RATE_EMPLOYER = 0.0325; // 3.25%
const ESI_WAGE_LIMIT = 21000;
const PF_WAGE_LIMIT = 15000;     // PF calculated on max ₹15,000 for employer cap
const PROFESSIONAL_TAX_KA = 200; // Karnataka: ₹200/month for salary > ₹10,000
const HRA_PCT = 0.40;            // 40% of basic (non-metro)
const SPECIAL_ALLOWANCE_PCT = 0.20;

export class PayrollService {
  private ledger = new LedgerService();

  /**
   * Process monthly payroll for all active employees.
   * Called by cron job or manual trigger.
   */
  async processMonthlyPayroll(
    payPeriodFrom: Date,
    payPeriodTo: Date,
    processedBy: string
  ) {
    // Check if payroll already processed for this period
    const existing = await prisma.payrollEntry.findFirst({
      where: { payPeriodFrom, payPeriodTo },
    });
    if (existing) {
      throw new ConflictError(
        `Payroll already processed for period ${payPeriodFrom.toISOString().slice(0, 7)}`
      );
    }

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
    });

    if (!employees.length) throw new BusinessRuleError('No active employees found');

    const entries = [];
    for (const emp of employees) {
      const entry = await this.calculatePayslip(emp, payPeriodFrom, payPeriodTo);
      entries.push(entry);
    }

    // Create all payroll entries in a transaction
    const created = await prisma.$transaction(
      entries.map(e => prisma.payrollEntry.create({ data: e }))
    );

    // Post to GL
    const totalGross = created.reduce((s, e) => s + Number(e.grossSalary), 0);
    const totalPfEmployer = created.reduce((s, e) => s + Number(e.pfEmployer), 0);
    const totalEsiEmployer = created.reduce((s, e) => s + Number(e.esiEmployer), 0);
    const totalNetSalary = created.reduce((s, e) => s + Number(e.netSalary), 0);

    await this.postPayrollToGL(
      payPeriodFrom,
      totalGross,
      totalPfEmployer,
      totalEsiEmployer,
      totalNetSalary
    );

    auditLog({
      userId: processedBy,
      action: 'PROCESS_PAYROLL',
      entityType: 'PAYROLL',
      newValues: { period: payPeriodFrom.toISOString().slice(0, 7), count: created.length, totalGross },
    });

    return { processed: created.length, totalGross, totalNetSalary, entries: created };
  }

  /**
   * Calculate individual payslip with all statutory deductions.
   */
  private calculatePayslip(employee: any, from: Date, to: Date) {
    const basic = Number(employee.basicSalary);
    const hra = Math.round(basic * HRA_PCT);
    const specialAllowance = Math.round(basic * SPECIAL_ALLOWANCE_PCT);
    const grossSalary = basic + hra + specialAllowance;

    // PF: 12% of Basic (employee & employer)
    const pfBase = Math.min(basic, PF_WAGE_LIMIT);
    const pfEmployee = Math.round(pfBase * PF_RATE_EMPLOYEE);
    const pfEmployer = Math.round(pfBase * PF_RATE_EMPLOYER);

    // ESI: only if gross ≤ ₹21,000
    const esiEmployee = grossSalary <= ESI_WAGE_LIMIT
      ? Math.round(grossSalary * ESI_RATE_EMPLOYEE) : 0;
    const esiEmployer = grossSalary <= ESI_WAGE_LIMIT
      ? Math.round(grossSalary * ESI_RATE_EMPLOYER) : 0;

    // Professional Tax (Karnataka)
    const professionalTax = basic > 10000 ? PROFESSIONAL_TAX_KA : 0;

    // TDS on salary (simplified — use Form 16 calc in production)
    const annualTaxable = (grossSalary - pfEmployee) * 12;
    const tdsIncome = annualTaxable > 500000
      ? Math.round(this.calculateIncomeTax(annualTaxable) / 12) : 0;

    const totalDeductions = pfEmployee + esiEmployee + professionalTax + tdsIncome;
    const netSalary = grossSalary - totalDeductions;

    // Working days in period
    const workingDays = this.getWorkingDays(from, to);

    return {
      entryNumber: `PAY-${from.toISOString().slice(0, 7)}-${employee.employeeCode}`,
      employeeId: employee.id,
      projectId: employee.projectId,
      payPeriodFrom: from,
      payPeriodTo: to,
      workingDays,
      presentDays: workingDays,
      overtimeHours: 0,
      basicSalary: basic,
      hra,
      specialAllowance,
      overtimePay: 0,
      otherAllowances: 0,
      grossSalary,
      pfEmployee,
      pfEmployer,
      esiEmployee,
      esiEmployer,
      tdsIncome,
      professionalTax,
      loanDeduction: 0,
      otherDeductions: 0,
      totalDeductions,
      netSalary,
      paymentStatus: 'PENDING',
    };
  }

  /**
   * Approve and initiate bank transfer for payroll.
   */
  async approvePayroll(period: string, approvedById: string) {
    const [yearStr, monthStr] = period.split('-');
    const from = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const to = new Date(parseInt(yearStr), parseInt(monthStr), 0);

    const entries = await prisma.payrollEntry.findMany({
      where: { payPeriodFrom: from, paymentStatus: 'PENDING' },
      include: { employee: true },
    });

    if (!entries.length) throw new NotFoundError('Payroll entries for period', period);

    await prisma.payrollEntry.updateMany({
      where: { payPeriodFrom: from, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'PROCESSING' },
    });

    // In production: integrate with bank API (NPCI NACH or RazorpayX)
    // For now: mark as PAID
    await prisma.payrollEntry.updateMany({
      where: { payPeriodFrom: from, paymentStatus: 'PROCESSING' },
      data: { paymentStatus: 'PAID', paymentDate: new Date() },
    });

    auditLog({
      userId: approvedById,
      action: 'APPROVE_PAYROLL',
      entityType: 'PAYROLL',
      newValues: { period, count: entries.length },
    });

    return { approved: entries.length, period };
  }

  /**
   * Get payroll summary for a period.
   */
  async getPayrollSummary(period: string) {
    const [yearStr, monthStr] = period.split('-');
    const from = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);

    const entries = await prisma.payrollEntry.findMany({
      where: { payPeriodFrom: from },
      include: { employee: { select: { name: true, employeeCode: true, designation: true, department: true } } },
    });

    const summary = {
      period,
      headCount: entries.length,
      totalGross: entries.reduce((s, e) => s + Number(e.grossSalary), 0),
      totalPfEmployee: entries.reduce((s, e) => s + Number(e.pfEmployee), 0),
      totalPfEmployer: entries.reduce((s, e) => s + Number(e.pfEmployer), 0),
      totalEsiEmployee: entries.reduce((s, e) => s + Number(e.esiEmployee), 0),
      totalEsiEmployer: entries.reduce((s, e) => s + Number(e.esiEmployer), 0),
      totalTds: entries.reduce((s, e) => s + Number(e.tdsIncome), 0),
      totalNetSalary: entries.reduce((s, e) => s + Number(e.netSalary), 0),
      paymentStatus: entries[0]?.paymentStatus || 'PENDING',
    };

    return { summary, entries };
  }

  async getEmployeePayslip(employeeId: string, period: string) {
    const [yearStr, monthStr] = period.split('-');
    const from = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);

    const entry = await prisma.payrollEntry.findFirst({
      where: { employeeId, payPeriodFrom: from },
      include: { employee: true },
    });
    if (!entry) throw new NotFoundError('Payslip', `${employeeId}/${period}`);
    return entry;
  }

  private async postPayrollToGL(
    date: Date,
    grossSalary: number,
    pfEmployer: number,
    esiEmployer: number,
    netSalary: number
  ) {
    // Payroll GL:
    // Dr. Salary & Wages (gross + employer PF + employer ESI)
    // Cr. PF Payable (employee + employer PF)
    // Cr. ESI Payable (employee + employer ESI)
    // Cr. TDS Payable (income tax)
    // Cr. Bank Account (net salary)
    await this.ledger.createAutoJournalEntry({
      referenceType: 'PAYROLL',
      referenceId: date.toISOString(),
      description: `Payroll: ${date.toISOString().slice(0, 7)}`,
      entryDate: date,
      invoiceType: 'PAYROLL',
      grandTotal: grossSalary + pfEmployer + esiEmployer,
      tdsAmount: 0,
      gstAmount: 0,
    });
  }

  private calculateIncomeTax(annualIncome: number): number {
    // FY2024-25 new regime (simplified)
    if (annualIncome <= 300000) return 0;
    if (annualIncome <= 600000) return (annualIncome - 300000) * 0.05;
    if (annualIncome <= 900000) return 15000 + (annualIncome - 600000) * 0.10;
    if (annualIncome <= 1200000) return 45000 + (annualIncome - 900000) * 0.15;
    if (annualIncome <= 1500000) return 90000 + (annualIncome - 1200000) * 0.20;
    return 150000 + (annualIncome - 1500000) * 0.30;
  }

  private getWorkingDays(from: Date, to: Date): number {
    let count = 0;
    const current = new Date(from);
    while (current <= to) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
}

// ============================================================
// src/modules/payroll/payroll.controller.ts + routes
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';

const payrollService = new PayrollService();

const processPayroll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payPeriodFrom, payPeriodTo } = req.body;
    res.status(201).json(
      await payrollService.processMonthlyPayroll(
        new Date(payPeriodFrom),
        new Date(payPeriodTo),
        req.user!.userId
      )
    );
  } catch (err) { next(err); }
};

const approvePayroll = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await payrollService.approvePayroll(req.params.period, req.user!.userId)); }
  catch (err) { next(err); }
};

const getPayrollSummary = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await payrollService.getPayrollSummary(req.params.period)); }
  catch (err) { next(err); }
};

const getPayslip = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await payrollService.getEmployeePayslip(req.params.employeeId, req.params.period)); }
  catch (err) { next(err); }
};

const payrollRouter = Router();
payrollRouter.get('/:period/summary', getPayrollSummary);
payrollRouter.get('/employee/:employeeId/:period', getPayslip);
payrollRouter.post('/process', authorize('ADMIN', 'ACCOUNTANT'), processPayroll);
payrollRouter.post('/:period/approve', authorize('ADMIN'), approvePayroll);

export default payrollRouter;
