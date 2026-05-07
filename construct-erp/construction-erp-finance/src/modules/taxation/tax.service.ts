// ============================================================
// src/modules/taxation/tax.service.ts
// GST compliance: GSTR-1, GSTR-2A, GSTR-3B
// TDS compliance: Form 26Q, Challan 281
// ============================================================
import { prisma } from '../../lib/prisma';
import { BusinessRuleError } from '../../lib/errors';
import { auditLog } from '../../lib/audit';

export class TaxService {
  // ── GST ────────────────────────────────────────────

  /**
   * GSTR-1: Outward supplies (client invoices) for a period.
   * Period format: YYYY-MM (e.g., "2024-07")
   */
  async getGSTR1(period: string) {
    const [year, month] = period.split('-').map(Number);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    const invoices = await prisma.invoice.findMany({
      where: {
        type: 'CLIENT_INVOICE',
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        invoiceDate: { gte: from, lte: to },
      },
      include: {
        client: { select: { name: true, gstin: true } },
        gstEntries: true,
        lineItems: true,
      },
    });

    const b2b: any[] = []; // B2B (registered) supplies
    const b2c: any[] = []; // B2C (unregistered) supplies

    for (const inv of invoices) {
      const gstSummary = this.summarizeGST(inv.gstEntries);
      const entry = {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        taxableValue: Number(inv.taxableAmount),
        cgst: gstSummary.cgst,
        sgst: gstSummary.sgst,
        igst: gstSummary.igst,
        total: Number(inv.grandTotal),
      };

      if (inv.client?.gstin) {
        b2b.push({ ...entry, gstin: inv.client.gstin, name: inv.client.name });
      } else {
        b2c.push(entry);
      }
    }

    const totalTaxableValue = [...b2b, ...b2c].reduce((s, i) => s + i.taxableValue, 0);
    const totalGst = [...b2b, ...b2c].reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);

    return {
      period,
      b2b,
      b2c,
      summary: {
        totalInvoices: invoices.length,
        totalTaxableValue,
        totalCGST: [...b2b, ...b2c].reduce((s, i) => s + i.cgst, 0),
        totalSGST: [...b2b, ...b2c].reduce((s, i) => s + i.sgst, 0),
        totalIGST: [...b2b, ...b2c].reduce((s, i) => s + i.igst, 0),
        totalGST: totalGst,
        totalOutwardSupplies: totalTaxableValue + totalGst,
      },
    };
  }

  /**
   * GSTR-3B Summary: Net tax liability for the period.
   */
  async getGSTR3BSummary(period: string) {
    const [gstr1, gstr2a] = await Promise.all([
      this.getGSTR1(period),
      this.getGSTR2A(period),
    ]);

    const outputTax = {
      cgst: gstr1.summary.totalCGST,
      sgst: gstr1.summary.totalSGST,
      igst: gstr1.summary.totalIGST,
      total: gstr1.summary.totalGST,
    };

    const inputTax = {
      cgst: gstr2a.summary.cgst,
      sgst: gstr2a.summary.sgst,
      igst: gstr2a.summary.igst,
      total: gstr2a.summary.totalItc,
    };

    const netTax = {
      cgst: Math.max(0, outputTax.cgst - inputTax.cgst),
      sgst: Math.max(0, outputTax.sgst - inputTax.sgst),
      igst: Math.max(0, outputTax.igst - inputTax.igst),
      total: 0,
    };
    netTax.total = netTax.cgst + netTax.sgst + netTax.igst;

    return { period, outputTax, inputTax, netTax, filingStatus: 'PENDING' };
  }

  /**
   * GSTR-2A: Inward supplies with ITC eligibility.
   */
  async getGSTR2A(period: string) {
    const entries = await prisma.gSTEntry.findMany({
      where: { gstrPeriod: period, isItcEligible: true, invoice: { type: 'VENDOR_INVOICE' } },
      include: {
        invoice: {
          include: { vendor: { select: { name: true, gstin: true, vendorCode: true } } },
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
   * Mark ITC as availed for eligible entries.
   */
  async availITC(period: string, userId: string) {
    const result = await prisma.gSTEntry.updateMany({
      where: { gstrPeriod: period, isItcEligible: true, itcAvailed: false },
      data: { itcAvailed: true, itcAvailedDate: new Date() },
    });
    auditLog({ userId, action: 'AVAIL_ITC', entityType: 'TAX', newValues: { period, count: result.count } });
    return { period, itcAvailed: result.count };
  }

  // ── TDS ────────────────────────────────────────────

  /**
   * TDS Register: All deductions for a quarter.
   * Quarter format: Q1-FY2025, Q2-FY2025, etc.
   */
  async getTDSRegister(quarter: string) {
    const entries = await prisma.tDSEntry.findMany({
      where: { quarterPeriod: quarter },
      include: {
        vendor: { select: { name: true, panNumber: true, vendorCode: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { deductionDate: 'asc' },
    });

    const bySection: Record<string, {
      section: string; count: number;
      totalBase: number; totalTds: number; totalSurcharge: number;
    }> = {};

    for (const e of entries) {
      if (!bySection[e.section]) {
        bySection[e.section] = { section: e.section, count: 0, totalBase: 0, totalTds: 0, totalSurcharge: 0 };
      }
      bySection[e.section].count++;
      bySection[e.section].totalBase += Number(e.baseAmount);
      bySection[e.section].totalTds += Number(e.tdsAmount);
      bySection[e.section].totalSurcharge += Number(e.surcharge);
    }

    return {
      quarter,
      entries,
      sectionSummary: Object.values(bySection),
      totalTdsDeducted: entries.reduce((s, e) => s + Number(e.totalTds), 0),
      depositedCount: entries.filter(e => e.depositedDate).length,
      pendingDeposit: entries.filter(e => !e.depositedDate).length,
    };
  }

  /**
   * Record TDS challan payment (Challan 281).
   */
  async recordTDSDeposit(
    quarterPeriod: string,
    section: string,
    challanNumber: string,
    bsrCode: string,
    depositedDate: string,
    userId: string
  ) {
    const result = await prisma.tDSEntry.updateMany({
      where: {
        quarterPeriod,
        section: section as any,
        depositedDate: null,
      },
      data: {
        depositedDate: new Date(depositedDate),
        challanNumber,
        bsrCode,
        form26QStatus: 'FILED',
      },
    });

    auditLog({
      userId,
      action: 'TDS_DEPOSIT',
      entityType: 'TAX',
      newValues: { quarterPeriod, section, challanNumber, count: result.count },
    });

    return { updated: result.count };
  }

  /**
   * Form 26Q data — TDS on contractor/professional payments.
   */
  async getForm26Q(quarter: string) {
    const entries = await prisma.tDSEntry.findMany({
      where: {
        quarterPeriod: quarter,
        section: { in: ['SEC_194C', 'SEC_194J', 'SEC_194I', 'SEC_194Q'] as any[] },
      },
      include: {
        vendor: { select: { name: true, panNumber: true, vendorCode: true } },
      },
    });

    return {
      quarter,
      form: '26Q',
      deductorDetails: {
        tan: process.env.COMPANY_TAN || 'BLRA12345A',
        pan: process.env.COMPANY_PAN || 'AAKCK1234A',
        name: process.env.COMPANY_NAME || 'Construction Company',
      },
      deducteeDetails: entries.map(e => ({
        pan: e.vendor?.panNumber || 'PANNOTAVBL',
        name: e.vendor?.name,
        section: e.section,
        paymentDate: e.deductionDate,
        grossAmount: Number(e.baseAmount),
        tdsRate: Number(e.rate),
        tdsAmount: Number(e.totalTds),
        challanNumber: e.challanNumber,
        depositedDate: e.depositedDate,
      })),
      summary: {
        totalEntries: entries.length,
        totalTaxDeducted: entries.reduce((s, e) => s + Number(e.totalTds), 0),
        totalDeposited: entries.filter(e => e.depositedDate)
          .reduce((s, e) => s + Number(e.totalTds), 0),
      },
    };
  }

  /**
   * GST reconciliation: Compare GSTR-2A with books.
   */
  async reconcileGST(period: string) {
    const gstr2a = await this.getGSTR2A(period);

    // Check which ITC is still unclaimed
    const unclaimedEntries = gstr2a.entries.filter(e => !e.itcAvailed);
    const claimedEntries = gstr2a.entries.filter(e => e.itcAvailed);

    return {
      period,
      totalEligibleITC: gstr2a.summary.totalItc,
      claimedITC: claimedEntries.reduce((s, e) => s + Number(e.taxAmount), 0),
      pendingITC: unclaimedEntries.reduce((s, e) => s + Number(e.taxAmount), 0),
      claimedCount: claimedEntries.length,
      pendingCount: unclaimedEntries.length,
      unclaimedEntries,
    };
  }

  private summarizeGST(entries: any[]) {
    return entries.reduce((acc, e) => {
      if (e.type === 'CGST') acc.cgst += Number(e.taxAmount);
      else if (e.type === 'SGST') acc.sgst += Number(e.taxAmount);
      else if (e.type === 'IGST') acc.igst += Number(e.taxAmount);
      return acc;
    }, { cgst: 0, sgst: 0, igst: 0 });
  }
}

// ============================================================
// src/modules/taxation/tax.routes.ts + controller
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';

const taxService = new TaxService();

const taxRouter = Router();

taxRouter.get('/gst/gstr1/:period', authorize('ADMIN', 'ACCOUNTANT', 'AUDITOR'), async (req, res, next) => {
  try { res.json(await taxService.getGSTR1(req.params.period)); } catch (err) { next(err); }
});

taxRouter.get('/gst/gstr2a/:period', authorize('ADMIN', 'ACCOUNTANT', 'AUDITOR'), async (req, res, next) => {
  try { res.json(await taxService.getGSTR2A(req.params.period)); } catch (err) { next(err); }
});

taxRouter.get('/gst/gstr3b/:period', authorize('ADMIN', 'ACCOUNTANT'), async (req, res, next) => {
  try { res.json(await taxService.getGSTR3BSummary(req.params.period)); } catch (err) { next(err); }
});

taxRouter.post('/gst/avail-itc/:period', authorize('ADMIN', 'ACCOUNTANT'), async (req, res, next) => {
  try { res.json(await taxService.availITC(req.params.period, req.user!.userId)); } catch (err) { next(err); }
});

taxRouter.get('/gst/reconcile/:period', authorize('ADMIN', 'ACCOUNTANT', 'AUDITOR'), async (req, res, next) => {
  try { res.json(await taxService.reconcileGST(req.params.period)); } catch (err) { next(err); }
});

taxRouter.get('/tds/register/:quarter', authorize('ADMIN', 'ACCOUNTANT', 'AUDITOR'), async (req, res, next) => {
  try { res.json(await taxService.getTDSRegister(req.params.quarter)); } catch (err) { next(err); }
});

taxRouter.get('/tds/form26q/:quarter', authorize('ADMIN', 'ACCOUNTANT'), async (req, res, next) => {
  try { res.json(await taxService.getForm26Q(req.params.quarter)); } catch (err) { next(err); }
});

taxRouter.post('/tds/deposit', authorize('ADMIN', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const { quarterPeriod, section, challanNumber, bsrCode, depositedDate } = req.body;
    res.json(await taxService.recordTDSDeposit(
      quarterPeriod, section, challanNumber, bsrCode, depositedDate, req.user!.userId
    ));
  } catch (err) { next(err); }
});

export default taxRouter;
