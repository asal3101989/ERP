// src/routes/tqs-bills.routes.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const XLSX    = require('xlsx');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const { uploadToOneDrive, isConfigured } = require('../services/onedrive.service');
const logger = require('../utils/logger');


const router = express.Router();
router.use(authenticate);

const STAGE_DEPT_RULES = {
  stores: ['store'],
  document_control: ['document controller', 'document', 'controller', 'doc'],
  qs: ['qs'],
  accounts: ['account', 'finance'],
  procurement: ['procure', 'purchase'],
  payment: ['account', 'finance'],
};

function canAccessTqsStage(user, stage) {
  if (!user) return false;
  if (['super_admin', 'admin'].includes(user.role)) return true;
  const dept = String(user.department || '').toLowerCase();
  const tokens = STAGE_DEPT_RULES[stage] || [];
  return tokens.some(token => dept.includes(token));
}

function requireTqsStageAccess(stage) {
  return (req, res, next) => {
    if (canAccessTqsStage(req.user, stage)) return next();
    return res.status(403).json({ error: 'Access denied for your department.' });
  };
}

// ── Multer storage for bill file attachments ───────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/tqs-bills', req.params.id || 'tmp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function getBillProjectName(billId) {
  let projectName = 'General';
  const pr = await query(`
    SELECT p.name FROM projects p
    JOIN tqs_bills b ON b.project_id = p.id
    WHERE b.id = $1
  `, [billId]);
  if (pr.rows.length) projectName = pr.rows[0].name;
  return projectName;
}

// ── Auto-create tables ─────────────────────────────────────────────────────
async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS tqs_bills (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id      UUID,
      project_id      UUID,
      sl_number       TEXT UNIQUE NOT NULL,
      vendor_id       UUID,
      vendor_name     TEXT,
      po_number       TEXT,
      po_date         DATE,
      inv_number      TEXT,
      inv_date        DATE,
      inv_month       TEXT,
      received_date   DATE,
      basic_amount    NUMERIC(14,2) DEFAULT 0,
      cgst_pct        NUMERIC(5,2)  DEFAULT 0,
      cgst_amt        NUMERIC(14,2) DEFAULT 0,
      sgst_pct        NUMERIC(5,2)  DEFAULT 0,
      sgst_amt        NUMERIC(14,2) DEFAULT 0,
      igst_pct        NUMERIC(5,2)  DEFAULT 0,
      igst_amt        NUMERIC(14,2) DEFAULT 0,
      gst_amount      NUMERIC(14,2) DEFAULT 0,
      transport_charges NUMERIC(14,2) DEFAULT 0,
      other_charges   NUMERIC(14,2) DEFAULT 0,
      total_amount    NUMERIC(14,2) DEFAULT 0,
      bill_type       TEXT DEFAULT 'po',
      workflow_status TEXT DEFAULT 'pending',
      remarks         TEXT,
      is_deleted      BOOLEAN DEFAULT FALSE,
      created_by      UUID,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tqs_bill_updates (
      bill_id           UUID PRIMARY KEY REFERENCES tqs_bills(id) ON DELETE CASCADE,
      store_recv_date   DATE,
      dc_number         TEXT,
      vehicle_number    TEXT,
      inspection_status TEXT,
      received_by       TEXT,
      sent_to_ho_date   DATE,
      store_remarks     TEXT,
      ho_received_date  DATE,
      handed_over_qs_date DATE,
      document_controller_remarks TEXT,
      qs_received_date  DATE,
      qs_certified_date DATE,
      handed_over_accounts_date DATE,
      qs_gross          NUMERIC(14,2),
      qs_tax            NUMERIC(14,2),
      qs_total          NUMERIC(14,2),
      advance_recovered NUMERIC(14,2) DEFAULT 0,
      credit_note_amt   NUMERIC(14,2) DEFAULT 0,
      retention_money   NUMERIC(14,2) DEFAULT 0,
      tds_deduction     NUMERIC(14,2) DEFAULT 0,
      other_deductions  NUMERIC(14,2) DEFAULT 0,
      total_deductions  NUMERIC(14,2) DEFAULT 0,
      certified_net     NUMERIC(14,2),
      qs_remarks        TEXT,
      accts_received_from_qs_date DATE,
      accts_jv_date     DATE,
      accts_remarks     TEXT,
      proc_received_from_accounts_date DATE,
      proc_handed_over_to_accounts_date DATE,
      procurement_remarks TEXT,
      payment_status    TEXT DEFAULT 'pending',
      paid_amount       NUMERIC(14,2) DEFAULT 0,
      balance_to_pay    NUMERIC(14,2),
      payment_date      DATE,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tqs_bill_line_items (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id      UUID REFERENCES tqs_bills(id) ON DELETE CASCADE,
      item_name    TEXT,
      unit         TEXT,
      quantity     NUMERIC(14,3),
      rate         NUMERIC(14,2),
      basic_amount NUMERIC(14,2),
      gst_pct      NUMERIC(5,2) DEFAULT 18,
      gst_amount   NUMERIC(14,2),
      total_amount NUMERIC(14,2),
      sort_order   INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tqs_bill_files (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id     UUID REFERENCES tqs_bills(id) ON DELETE CASCADE,
      file_name   TEXT,
      file_size   INT,
      file_type   TEXT,
      local_url   TEXT,
      onedrive_id      TEXT,
      onedrive_url     TEXT,
      onedrive_web_url TEXT,
      uploaded_by UUID,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tqs_bill_history (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id     UUID REFERENCES tqs_bills(id) ON DELETE CASCADE,
      dept        TEXT,
      action      TEXT,
      changed_by  UUID,
      ts          TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Add columns introduced after initial migration
  const alterBills = [
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS work_desc TEXT`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS tax_mode TEXT DEFAULT 'intrastate'`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS credit_note_num TEXT`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS credit_note_val NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS transport_gst_pct NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS transport_gst_amt NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS transport_desc TEXT`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS other_charges_desc TEXT`,
    // ── Cross-module linkage (procurement) ─────────────────────────
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS po_id UUID`,
    `ALTER TABLE tqs_bills ADD COLUMN IF NOT EXISTS grn_id UUID`,
  ];
  const alterItems = [
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS item_code TEXT`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS gst_mode TEXT DEFAULT 'intrastate'`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS cgst_pct NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS cgst_amt NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS sgst_pct NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS sgst_amt NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS igst_pct NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS igst_amt NUMERIC(14,2) DEFAULT 0`,
    // PO linkage — tracks which PO line item this bill line is drawn against
    `ALTER TABLE tqs_bill_line_items ADD COLUMN IF NOT EXISTS po_item_id UUID`,
  ];
  const alterUpdates = [
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS ra_sequence INT DEFAULT 1`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS ra_bill_number TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS previous_certified_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS cumulative_certified_amount NUMERIC(14,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS is_final_bill BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_number TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_generated_at TIMESTAMPTZ`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_qs_sig_img TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_qs_signed_by TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_qs_signed_at TIMESTAMPTZ`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_pm_sig_img TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_pm_signed_by TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_pm_signed_at TIMESTAMPTZ`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_accts_sig_img TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_accts_signed_by TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS pc_accts_signed_at TIMESTAMPTZ`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS sent_to_ho_date DATE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS ho_received_date DATE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS handed_over_qs_date DATE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS document_controller_remarks TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS handed_over_accounts_date DATE`,
    // ── Finance linkage ──
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS payment_mode TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS reference_number TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS bank_name TEXT`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS finance_payment_id UUID`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS qs_summary_template JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS qs_ra_items JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS ra_cgst_pct NUMERIC(5,2) DEFAULT 9`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS ra_sgst_pct NUMERIC(5,2) DEFAULT 9`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS ra_igst_pct NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS accts_received_from_qs_date DATE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS proc_received_from_accounts_date DATE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS proc_handed_over_to_accounts_date DATE`,
    `ALTER TABLE tqs_bill_updates ADD COLUMN IF NOT EXISTS procurement_remarks TEXT`,
  ];
  // ── Extend payments table to accept TQS-originated records ──────────────
  const alterPayments = [
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS tqs_bill_id UUID`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`,
    // Drop the narrow check constraint so RTGS/NEFT/Cheque etc. are accepted
    `ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_mode_check`,
  ];
  const alterFiles = [
    `ALTER TABLE tqs_bill_files ADD COLUMN IF NOT EXISTS onedrive_id TEXT`,
    `ALTER TABLE tqs_bill_files ADD COLUMN IF NOT EXISTS onedrive_url TEXT`,
    `ALTER TABLE tqs_bill_files ADD COLUMN IF NOT EXISTS onedrive_web_url TEXT`,
  ];
  for (const sql of [...alterBills, ...alterItems, ...alterUpdates, ...alterPayments, ...alterFiles]) {
    await query(sql).catch(() => {}); // ignore if already exists
  }
}
ensureTables().catch(console.error);

// ── Helper: generate SL number ─────────────────────────────────────────────
async function nextSlNumber() {
  // Find the highest numeric value across ALL sl_numbers (strips any prefix/suffix)
  const res = await query(
    `SELECT sl_number FROM tqs_bills WHERE sl_number IS NOT NULL ORDER BY created_at DESC LIMIT 50`
  );
  if (res.rows.length === 0) return '351';
  let max = 0;
  for (const row of res.rows) {
    const match = String(row.sl_number).match(/(\d+)/g);
    if (match) {
      const nums = match.map(Number);
      const biggest = Math.max(...nums);
      if (biggest > max) max = biggest;
    }
  }
  return String(max + 1);
}

// ── Helper: log history ────────────────────────────────────────────────────
async function logHistory(billId, dept, action, userId) {
  await query(
    `INSERT INTO tqs_bill_history (bill_id, dept, action, changed_by) VALUES ($1,$2,$3,$4)`,
    [billId, dept, action, userId]
  );
}

function excelDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const mm = String(parsed.m).padStart(2, '0');
    const dd = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${mm}-${dd}`;
  }
  const text = String(value).trim();
  if (!text || text === '-') return null;
  const parts = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (parts) {
    const yyyy = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return `${yyyy}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function excelText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text && text !== '-' ? text : null;
}

function excelNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[₹,\s]/g, '').trim();
  if (!cleaned || cleaned === '-') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findHeaderRow(rows) {
  return rows.findIndex(row => {
    const headers = row.map(normalizeHeader);
    return headers.includes('vendor name') && headers.includes('invoice number');
  });
}

function parseTqsTrackerSheet(workbook, sheetName, billType) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false, defval: '' });
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map(normalizeHeader);
  const serialHeaderRow = headerIndex > 0 ? rows[headerIndex - 1].map(normalizeHeader) : [];
  const indexOf = (...names) => {
    const wanted = names.map(normalizeHeader);
    return headers.findIndex(h => wanted.includes(h));
  };
  const indexOfSerial = () => {
    const direct = indexOf('S.no', 'S.No', 'S No');
    if (direct >= 0) return direct;
    const prevRowMatch = serialHeaderRow.findIndex(h => h === 's no' || h === 's no.');
    if (prevRowMatch >= 0) return prevRowMatch;
    return 0;
  };
  const indexes = {
    serial: indexOfSerial(),
    vendor: indexOf('Vendor Name'),
    orderNumber: indexOf(billType === 'wo' ? 'Work Order Number' : 'Purchase Order Number'),
    orderDate: indexOf(billType === 'wo' ? 'Work order Date' : 'Purchase order Date'),
    invoiceNumber: indexOf('Invoice Number'),
    invoiceDate: indexOf('Invoice Date'),
    invoiceMonth: indexOf('Invoice Month,year'),
    receivedDate: indexOf('Received Date'),
    basic: indexOf('Basic Amount without GST'),
    gst: indexOf('GST Amount'),
    total: indexOf('Total Amount Inclusive of GST'),
    transport: indexOf('TRANSPORT CHARGES'),
    creditNoteNumber: indexOf('Credit Note Number'),
    creditNoteValue: indexOf('Credit note Value'),
    comments: indexOf('Comments'),
    qsGross: indexOf('QS Certified - Gross Amount'),
    qsTax: indexOf('QS Certified - Total Tax Amount'),
    qsTotal: indexOf('QS Certified - Total Gross Amount with GST'),
    advanceRecovered: indexOf('Advance Amount Recovered'),
    otherDeductions: indexOf('Any Other Deductions'),
    retentionMoney: indexOf('Retention Money'),
    tds: indexOf('TDS'),
    totalDeductions: indexOf('Total Deductions Amount'),
    certifiedNet: indexOf('QS Certified - Certified Net Amount'),
    pcNumber: indexOf('Payment Certificate Number'),
    accountsDate: indexOf('Handing over to Account for JV Passing'),
    remarks: indexOf('Remarks'),
    paymentStatus: indexOf('Status of Payment Paid Not Paid'),
    paidAmount: indexOf('Paid Amount'),
    balance: indexOf('Balance To pay', 'Balance Amount'),
    bankReference: indexOf('Bank Reference Number Cheque No UTR Number'),
    paymentDate: indexOf('Date of Payment'),
  };

  const get = (row, key) => indexes[key] >= 0 ? row[indexes[key]] : '';
  return rows.slice(headerIndex + 1)
    .map((row) => {
      const vendorName = excelText(get(row, 'vendor'));
      const invNumber = excelText(get(row, 'invoiceNumber'));
      if (!vendorName || !invNumber) return null;
      const orderNumber = excelText(get(row, 'orderNumber'));
      const basic = excelNumber(get(row, 'basic'));
      const gstAmount = excelNumber(get(row, 'gst'));
      const transport = excelNumber(get(row, 'transport'));
      const total = excelNumber(get(row, 'total')) || basic + gstAmount + transport;
      const paidAmount = excelNumber(get(row, 'paidAmount'));
      const paymentStatusText = String(get(row, 'paymentStatus') || '').toLowerCase();
      const isPaid = paymentStatusText.includes('paid') || (paidAmount > 0 && Math.abs(paidAmount - total) < 1);

      return {
        source_sl_number: excelText(get(row, 'serial')),
        vendor_name: vendorName,
        po_number: orderNumber,
        po_date: excelDate(get(row, 'orderDate')),
        inv_number: invNumber,
        inv_date: excelDate(get(row, 'invoiceDate')),
        inv_month: excelDate(get(row, 'invoiceMonth')) || excelText(get(row, 'invoiceMonth')),
        received_date: excelDate(get(row, 'receivedDate')),
        basic_amount: basic,
        gst_amount: gstAmount,
        total_amount: total,
        transport_charges: transport,
        credit_note_num: excelText(get(row, 'creditNoteNumber')),
        credit_note_val: excelNumber(get(row, 'creditNoteValue')),
        bill_type: billType,
        remarks: excelText(get(row, 'remarks')) || excelText(get(row, 'comments')),
        workflow_status: isPaid ? 'paid' : 'accounts',
        updates: {
          qs_gross: excelNumber(get(row, 'qsGross')),
          qs_tax: excelNumber(get(row, 'qsTax')),
          qs_total: excelNumber(get(row, 'qsTotal')),
          advance_recovered: excelNumber(get(row, 'advanceRecovered')),
          credit_note_amt: excelNumber(get(row, 'creditNoteValue')),
          retention_money: excelNumber(get(row, 'retentionMoney')),
          tds_deduction: excelNumber(get(row, 'tds')),
          other_deductions: excelNumber(get(row, 'otherDeductions')),
          total_deductions: excelNumber(get(row, 'totalDeductions')),
          certified_net: excelNumber(get(row, 'certifiedNet')),
          pc_number: excelText(get(row, 'pcNumber')),
          handed_over_accounts_date: excelDate(get(row, 'accountsDate')),
          paid_amount: paidAmount,
          balance_to_pay: excelNumber(get(row, 'balance')),
          payment_status: isPaid ? 'paid' : 'pending',
          payment_date: excelDate(get(row, 'paymentDate')),
          reference_number: excelText(get(row, 'bankReference')),
        },
      };
    })
    .filter(Boolean);
}

function importSlNumber(row, fallback) {
  const source = String(row.source_sl_number || '').trim();
  if (!source) return fallback;
  return `${String(row.bill_type || 'po').toUpperCase()}-${source}`;
}

// ── Helper: generate PC number ─────────────────────────────────────────────
async function nextPCNumber() {
  const yr = new Date().getFullYear();
  const { rows } = await query(
    `SELECT COUNT(*) AS cnt FROM tqs_bill_updates WHERE pc_number LIKE $1`,
    [`PC-${yr}-%`]
  );
  const n = parseInt(rows[0].cnt, 10) + 1;
  return `PC-${yr}-${String(n).padStart(4, '0')}`;
}

// ── GET /tqs/bills/lookup/po-balance ─────────────────────────────────────
// Per PO item: ordered qty, GRN-received qty, already-invoiced qty, remaining
router.get('/lookup/po-balance', async (req, res) => {
  try {
    const { po_id } = req.query;
    if (!po_id) return res.status(400).json({ error: 'po_id required' });

    const { rows } = await query(`
      SELECT
        pi.id                                           AS po_item_id,
        pi.item_name,
        pi.unit,
        pi.quantity                                     AS ordered_qty,
        COALESCE(grn_agg.received_qty, 0)               AS received_qty,
        COALESCE(inv_agg.invoiced_qty, 0)               AS invoiced_qty,
        GREATEST(0,
          LEAST(pi.quantity, COALESCE(grn_agg.received_qty, 0))
          - COALESCE(inv_agg.invoiced_qty, 0)
        )                                               AS remaining_qty
      FROM po_items pi
      -- Sum GRN quantities for approved GRNs linked to this PO
      LEFT JOIN (
        SELECT gi.po_item_id, SUM(gi.quantity_received) AS received_qty
        FROM grn_items gi
        JOIN grn g ON g.id = gi.grn_id
        WHERE g.po_id = $1 AND g.quality_status = 'approved'
        GROUP BY gi.po_item_id
      ) grn_agg ON grn_agg.po_item_id = pi.id
      -- Sum already-invoiced quantities from non-deleted TQS bills
      LEFT JOIN (
        SELECT li.po_item_id, SUM(li.quantity) AS invoiced_qty
        FROM tqs_bill_line_items li
        JOIN tqs_bills b ON b.id = li.bill_id
        WHERE li.po_item_id IS NOT NULL
          AND b.is_deleted = FALSE
        GROUP BY li.po_item_id
      ) inv_agg ON inv_agg.po_item_id = pi.id
      WHERE pi.po_id = $1
      ORDER BY pi.id
    `, [po_id]);

    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills/lookup/pos ─────────────────────────────────────────────
// Returns approved POs from the procurement module, optionally filtered by project.
// Used by "Pick from PO" feature in the new-bill form.
router.get('/lookup/pos', async (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT po.id, po.po_number, po.po_date, po.grand_total AS total_amount,
             po.project_id, po.vendor_id,
             v.name AS vendor_name, p.name AS project_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      LEFT JOIN projects p ON p.id = po.project_id
      WHERE p.company_id = $1
        AND po.status IN ('approved','completed')
    `;
    const params = [req.user.company_id];
    if (project_id) { sql += ` AND po.project_id = $2`; params.push(project_id); }
    sql += ` ORDER BY po.po_date DESC NULLS LAST LIMIT 500`;
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills/lookup/grns ────────────────────────────────────────────
// Returns QC-approved GRNs (ready for invoicing) for a given PO or project.
router.get('/lookup/grns', async (req, res) => {
  try {
    const { project_id, po_id } = req.query;
    let sql = `
      SELECT g.id, g.grn_number, g.serial_no_formatted, g.grn_date, g.total_quantity,
             g.vendor_id, g.po_id, v.name AS vendor_name
      FROM grn g
      LEFT JOIN vendors v ON v.id = g.vendor_id
      LEFT JOIN projects p ON p.id = g.project_id
      WHERE p.company_id = $1 AND g.quality_status = 'approved'
    `;
    const params = [req.user.company_id];
    let i = 2;
    if (project_id) { sql += ` AND g.project_id = $${i++}`; params.push(project_id); }
    if (po_id)      { sql += ` AND g.po_id = $${i++}`;      params.push(po_id); }
    sql += ` ORDER BY g.grn_date DESC LIMIT 200`;
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills/ap-aging ────────────────────────────────────────────────
// Accounts Payable aging — certified bills not yet fully paid
router.get('/ap-aging', async (req, res) => {
  try {
    const { project_id } = req.query;
    let conditions = [`b.company_id = $1`, `b.is_deleted = FALSE`,
                      `b.workflow_status IN ('qs','accounts')`,
                      `COALESCE(u.certified_net, 0) > 0`];
    const params = [req.user.company_id];
    if (project_id) { conditions.push(`b.project_id = $2`); params.push(project_id); }

    const { rows } = await query(`
      SELECT
        b.id, b.sl_number, b.vendor_name, b.inv_number, b.inv_date,
        b.po_number, b.bill_type,
        p.name                                                   AS project_name,
        u.qs_certified_date,
        u.certified_net,
        COALESCE(u.paid_amount, 0)                               AS paid_amount,
        COALESCE(u.balance_to_pay,
          u.certified_net - COALESCE(u.paid_amount, 0))          AS balance,
        u.payment_status,
        u.pc_number,
        u.pc_qs_signed_at,
        u.pc_pm_signed_at,
        u.pc_accts_signed_at,
        EXTRACT(DAY FROM NOW() - u.qs_certified_date)::INT       AS days_outstanding,
        CASE
          WHEN u.qs_certified_date IS NULL                                       THEN 'unscheduled'
          WHEN EXTRACT(DAY FROM NOW() - u.qs_certified_date) <= 30              THEN '0-30'
          WHEN EXTRACT(DAY FROM NOW() - u.qs_certified_date) <= 60              THEN '31-60'
          WHEN EXTRACT(DAY FROM NOW() - u.qs_certified_date) <= 90              THEN '61-90'
          ELSE '90+'
        END                                                       AS aging_bucket
      FROM tqs_bills b
      LEFT JOIN tqs_bill_updates u ON u.bill_id = b.id
      LEFT JOIN projects p          ON p.id     = b.project_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY days_outstanding DESC NULLS LAST
    `, params);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills/vendor-ledger ───────────────────────────────────────────
// Outstanding balance summary per vendor across all TQS bills
// MUST be defined before /:id routes so Express doesn't swallow it as a param
router.get('/vendor-ledger', async (req, res) => {
  try {
    const { project_id, vendor_id } = req.query;
    let conditions = [`b.company_id = $1`, `b.is_deleted = FALSE`];
    const params   = [req.user.company_id];
    let i = 2;
    if (project_id) { conditions.push(`b.project_id = $${i++}`); params.push(project_id); }
    if (vendor_id)  { conditions.push(`b.vendor_id  = $${i++}`); params.push(vendor_id); }

    const { rows } = await query(`
      SELECT
        b.vendor_name,
        b.vendor_id,
        COUNT(b.id)                                   AS bill_count,
        COALESCE(SUM(b.total_amount),   0)            AS total_invoiced,
        COALESCE(SUM(u.certified_net),  0)            AS total_certified,
        COALESCE(SUM(u.paid_amount),    0)            AS total_paid,
        COALESCE(SUM(u.certified_net),  0) -
          COALESCE(SUM(u.paid_amount),  0)            AS outstanding,
        COALESCE(SUM(u.tds_deduction),  0)            AS total_tds,
        COALESCE(SUM(u.retention_money),0)            AS total_retention
      FROM tqs_bills b
      LEFT JOIN tqs_bill_updates u ON u.bill_id = b.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY b.vendor_name, b.vendor_id
      ORDER BY outstanding DESC
    `, params);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { project_id, status, search, from_date, to_date, from, to, bill_type } = req.query;
    // accept either from_date/to_date or from/to aliases sent by the Reports Hub
    const dateFrom = from_date || from;
    const dateTo   = to_date   || to;

    let conditions = ['b.is_deleted = FALSE'];
    let params = [];
    let i = 1;

    if (req.user.company_id) {
      conditions.push(`(b.company_id = $${i++} OR b.company_id IS NULL)`);
      params.push(req.user.company_id);
    }
    if (project_id) { conditions.push(`b.project_id = $${i++}`); params.push(project_id); }
    if (status)     { conditions.push(`b.workflow_status = $${i++}`); params.push(status); }
    if (bill_type)  { conditions.push(`b.bill_type = $${i++}`); params.push(bill_type); }
    if (dateFrom)   { conditions.push(`b.inv_date >= $${i++}`); params.push(dateFrom); }
    if (dateTo)     { conditions.push(`b.inv_date <= $${i++}`); params.push(dateTo); }
    if (search) {
      conditions.push(`(b.sl_number ILIKE $${i} OR b.inv_number ILIKE $${i} OR b.vendor_name ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const result = await query(`
      SELECT b.*,
             u.payment_status, u.paid_amount, u.balance_to_pay, u.certified_net,
             p.name AS project_name
      FROM tqs_bills b
      LEFT JOIN tqs_bill_updates u ON u.bill_id = b.id
      LEFT JOIN projects p ON p.id = b.project_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.inv_date DESC NULLS LAST, b.created_at DESC
    `, params);

    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /tqs/bills ────────────────────────────────────────────────────────
// Import the legacy "TQS PO Bill Tracker.xlsx" workbook.
router.post('/import-excel', importUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
    const rows = [
      ...parseTqsTrackerSheet(workbook, 'Purchase order Bills', 'po'),
      ...parseTqsTrackerSheet(workbook, 'Work order Bills', 'wo'),
    ];

    if (!rows.length) {
      return res.status(400).json({ error: 'No PO or WO bill rows found in this workbook.' });
    }

    const summary = await withTransaction(async (client) => {
      const maxRes = await client.query(`
        SELECT COALESCE(MAX(NULLIF(regexp_replace(sl_number, '\\D', '', 'g'), '')::INT), 350) AS max_sl
        FROM tqs_bills
      `);
      let nextSl = Number(maxRes.rows[0]?.max_sl || 350) + 1;
      const nextImportSl = () => String(nextSl++);
      const result = { imported: rows.length, created: 0, updated: 0 };

      for (const row of rows) {
        const existing = await client.query(`
          SELECT id FROM tqs_bills
          WHERE is_deleted = FALSE
            AND COALESCE(company_id::TEXT, '') = COALESCE($1::TEXT, '')
            AND lower(trim(COALESCE(vendor_name, ''))) = lower(trim($2))
            AND COALESCE(po_number, '') = COALESCE($3, '')
            AND COALESCE(inv_number, '') = COALESCE($4, '')
            AND COALESCE(bill_type, 'po') = $5
          LIMIT 1
        `, [
          req.user.company_id || null,
          row.vendor_name,
          row.po_number,
          row.inv_number,
          row.bill_type,
        ]);

        const importSl = importSlNumber(row, nextImportSl());
        let billId;
        if (existing.rows.length) {
          billId = existing.rows[0].id;
          await client.query(`
            UPDATE tqs_bills SET
              project_id = COALESCE($1, project_id),
              sl_number = $2,
              vendor_name = $3,
              po_number = $4,
              po_date = $5,
              inv_number = $6,
              inv_date = $7,
              inv_month = $8,
              received_date = $9,
              bill_type = $10,
              basic_amount = $11,
              gst_amount = $12,
              transport_charges = $13,
              credit_note_num = $14,
              credit_note_val = $15,
              total_amount = $16,
              workflow_status = $17,
              remarks = $18,
              updated_at = NOW()
            WHERE id = $19
          `, [
            req.body.project_id || null,
            importSl,
            row.vendor_name,
            row.po_number,
            row.po_date,
            row.inv_number,
            row.inv_date,
            row.inv_month,
            row.received_date,
            row.bill_type,
            row.basic_amount,
            row.gst_amount,
            row.transport_charges,
            row.credit_note_num,
            row.credit_note_val,
            row.total_amount,
            row.workflow_status,
            row.remarks,
            billId,
          ]);
          result.updated += 1;
        } else {
          const created = await client.query(`
            INSERT INTO tqs_bills (
              company_id, project_id, sl_number, vendor_name,
              po_number, po_date, inv_number, inv_date, inv_month, received_date,
              bill_type, basic_amount, gst_amount, transport_charges,
              credit_note_num, credit_note_val, total_amount, workflow_status,
              remarks, created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
            RETURNING id
          `, [
            req.user.company_id || null,
            req.body.project_id || null,
            importSl,
            row.vendor_name,
            row.po_number,
            row.po_date,
            row.inv_number,
            row.inv_date,
            row.inv_month,
            row.received_date,
            row.bill_type,
            row.basic_amount,
            row.gst_amount,
            row.transport_charges,
            row.credit_note_num,
            row.credit_note_val,
            row.total_amount,
            row.workflow_status,
            row.remarks,
            req.user.id || null,
          ]);
          billId = created.rows[0].id;
          result.created += 1;
        }

        const u = row.updates;
        await client.query(`
          INSERT INTO tqs_bill_updates (
            bill_id, qs_gross, qs_tax, qs_total, advance_recovered,
            credit_note_amt, retention_money, tds_deduction, other_deductions,
            total_deductions, certified_net, pc_number, handed_over_accounts_date,
            paid_amount, balance_to_pay, payment_status, payment_date, reference_number,
            updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
          ON CONFLICT (bill_id) DO UPDATE SET
            qs_gross = EXCLUDED.qs_gross,
            qs_tax = EXCLUDED.qs_tax,
            qs_total = EXCLUDED.qs_total,
            advance_recovered = EXCLUDED.advance_recovered,
            credit_note_amt = EXCLUDED.credit_note_amt,
            retention_money = EXCLUDED.retention_money,
            tds_deduction = EXCLUDED.tds_deduction,
            other_deductions = EXCLUDED.other_deductions,
            total_deductions = EXCLUDED.total_deductions,
            certified_net = EXCLUDED.certified_net,
            pc_number = EXCLUDED.pc_number,
            handed_over_accounts_date = EXCLUDED.handed_over_accounts_date,
            paid_amount = EXCLUDED.paid_amount,
            balance_to_pay = EXCLUDED.balance_to_pay,
            payment_status = EXCLUDED.payment_status,
            payment_date = EXCLUDED.payment_date,
            reference_number = EXCLUDED.reference_number,
            updated_at = NOW()
        `, [
          billId,
          u.qs_gross,
          u.qs_tax,
          u.qs_total,
          u.advance_recovered,
          u.credit_note_amt,
          u.retention_money,
          u.tds_deduction,
          u.other_deductions,
          u.total_deductions,
          u.certified_net,
          u.pc_number,
          u.handed_over_accounts_date,
          u.paid_amount,
          u.balance_to_pay,
          u.payment_status,
          u.payment_date,
          u.reference_number,
        ]);
      }

      return result;
    });

    res.json({ message: 'TQS tracker imported', ...summary });
  } catch (err) {
    logger.error('TQS tracker import failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      project_id, vendor_id, vendor_name,
      po_id, grn_id, po_number, po_date,
      inv_number, inv_date, inv_month, received_date, bill_type = 'po',
      work_desc, tax_mode = 'intrastate',
      basic_amount = 0, cgst_pct = 0, cgst_amt = 0,
      sgst_pct = 0, sgst_amt = 0, igst_pct = 0, igst_amt = 0,
      transport_charges = 0, transport_gst_pct = 0, transport_gst_amt = 0, transport_desc,
      other_charges = 0, other_charges_desc,
      credit_note_num, credit_note_val = 0,
      remarks, items = [],
    } = req.body;

    const gst_amount = parseFloat(cgst_amt) + parseFloat(sgst_amt) + parseFloat(igst_amt);
    const total_amount = parseFloat(basic_amount) + gst_amount +
                         parseFloat(transport_charges) + parseFloat(transport_gst_amt) +
                         parseFloat(other_charges);
    const sl_number = await nextSlNumber();

    const result = await withTransaction(async (client) => {
      const bill = await client.query(`
        INSERT INTO tqs_bills (
          company_id, project_id, sl_number, vendor_id, vendor_name,
          po_id, grn_id, po_number, po_date, inv_number, inv_date, inv_month, received_date,
          bill_type, work_desc, tax_mode,
          basic_amount, cgst_pct, cgst_amt, sgst_pct, sgst_amt,
          igst_pct, igst_amt, gst_amount,
          transport_charges, transport_gst_pct, transport_gst_amt, transport_desc,
          other_charges, other_charges_desc,
          credit_note_num, credit_note_val,
          total_amount, remarks, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
        RETURNING *
      `, [
        req.user.company_id, project_id, sl_number, vendor_id || null, vendor_name,
        po_id || null, grn_id || null,
        po_number, po_date || null, inv_number, inv_date || null,
        inv_month, received_date || null,
        bill_type, work_desc || null, tax_mode,
        basic_amount, cgst_pct, cgst_amt, sgst_pct, sgst_amt,
        igst_pct, igst_amt, gst_amount,
        transport_charges, transport_gst_pct, transport_gst_amt, transport_desc || null,
        other_charges, other_charges_desc || null,
        credit_note_num || null, credit_note_val,
        total_amount, remarks || null, req.user.id,
      ]);

      const billId = bill.rows[0].id;

      await client.query(
        `INSERT INTO tqs_bill_updates (bill_id, balance_to_pay) VALUES ($1, $2)`,
        [billId, total_amount]
      );

      // ── PO quantity guard ────────────────────────────────────────────────
      // For any line item that carries a po_item_id, check the remaining
      // invoiceable qty (min(ordered, GRN-received) − already invoiced).
      // Do this INSIDE the transaction so we lock against concurrent bills.
      const poItemIds = items.map(it => it.po_item_id).filter(Boolean);
      if (poItemIds.length) {
        const balRes = await client.query(`
          SELECT
            pi.id                                             AS po_item_id,
            pi.item_name,
            pi.quantity                                       AS ordered_qty,
            COALESCE(grn_agg.received_qty, 0)                 AS received_qty,
            COALESCE(inv_agg.invoiced_qty, 0)                 AS invoiced_qty,
            GREATEST(0,
              LEAST(pi.quantity, COALESCE(grn_agg.received_qty, 0))
              - COALESCE(inv_agg.invoiced_qty, 0)
            )                                                 AS remaining_qty
          FROM po_items pi
          LEFT JOIN (
            SELECT gi.po_item_id, SUM(gi.quantity_received) AS received_qty
            FROM grn_items gi
            JOIN grn g ON g.id = gi.grn_id
            WHERE g.po_id = (SELECT po_id FROM po_items WHERE id = $1 LIMIT 1)
              AND g.quality_status = 'approved'
            GROUP BY gi.po_item_id
          ) grn_agg ON grn_agg.po_item_id = pi.id
          LEFT JOIN (
            SELECT li.po_item_id, SUM(li.quantity) AS invoiced_qty
            FROM tqs_bill_line_items li
            JOIN tqs_bills b ON b.id = li.bill_id
            WHERE li.po_item_id = ANY($2::uuid[])
              AND b.is_deleted = FALSE
            GROUP BY li.po_item_id
          ) inv_agg ON inv_agg.po_item_id = pi.id
          WHERE pi.id = ANY($2::uuid[])
          FOR UPDATE OF pi
        `, [poItemIds[0], poItemIds]);

        const balMap = {};
        for (const row of balRes.rows) balMap[row.po_item_id] = row;

        for (const it of items) {
          if (!it.po_item_id) continue;
          const bal = balMap[it.po_item_id];
          if (!bal) continue;
          const requested = parseFloat(it.quantity || 0);
          const remaining = parseFloat(bal.remaining_qty);
          if (requested > remaining + 0.0001) {
            throw new Error(
              `Quantity exceeded for "${bal.item_name}": ` +
              `you entered ${requested} but only ${remaining} is available ` +
              `(ordered ${bal.ordered_qty}, GRN received ${bal.received_qty}, ` +
              `already invoiced ${bal.invoiced_qty}).`
            );
          }
        }
      }
      // ────────────────────────────────────────────────────────────────────

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const basic = parseFloat(it.basic_amount) || (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0));
        const gstPct = parseFloat(it.gst_pct || 18);
        const mode = it.gst_mode || tax_mode;
        let cgP = 0, sgP = 0, igP = 0, cgA = 0, sgA = 0, igA = 0;
        if (mode === 'interstate') { igP = gstPct; igA = basic * igP / 100; }
        else { cgP = gstPct / 2; sgP = gstPct / 2; cgA = basic * cgP / 100; sgA = basic * sgP / 100; }
        const gst_a = cgA + sgA + igA;
        await client.query(`
          INSERT INTO tqs_bill_line_items
            (bill_id, category, item_code, item_name, unit, quantity, rate,
             basic_amount, gst_pct, gst_mode,
             cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt,
             gst_amount, total_amount, sort_order, po_item_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [billId, it.category || null, it.item_code || null, it.item_name,
            it.unit, it.quantity, it.rate, basic, gstPct, mode,
            cgP, cgA, sgP, sgA, igP, igA, gst_a, basic + gst_a, idx,
            it.po_item_id || null]);
      }

      return bill.rows[0];
    });

    // logHistory uses the global pool (outside the transaction) so must run
    // after withTransaction commits — otherwise the FK on bill_id doesn't exist yet
    await logHistory(result.id, 'system', 'Bill created', req.user.id);

    res.status(201).json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tqs/bills/:id/meta — update project & package description ───────
router.patch('/:id/meta', async (req, res) => {
  try {
    const { project_id, work_desc } = req.body;
    await query(`UPDATE tqs_bills SET project_id=$1, work_desc=$2, updated_at=NOW() WHERE id=$3`,
      [project_id || null, work_desc || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [bill, updates, items, files, history] = await Promise.all([
      query(`
        SELECT b.*,
               p.name AS project_name,
               po.po_number    AS linked_po_number,
               po.grand_total  AS linked_po_total,
               g.grn_number    AS linked_grn_number,
               g.grn_date      AS linked_grn_date
        FROM tqs_bills b
        LEFT JOIN projects p         ON p.id  = b.project_id
        LEFT JOIN purchase_orders po ON po.id = b.po_id
        LEFT JOIN grn g              ON g.id  = b.grn_id
        WHERE b.id = $1 AND b.is_deleted = FALSE
      `, [req.params.id]),
      query(`SELECT * FROM tqs_bill_updates WHERE bill_id = $1`, [req.params.id]),
      query(`SELECT * FROM tqs_bill_line_items WHERE bill_id = $1 ORDER BY sort_order`, [req.params.id]),
      query(`SELECT * FROM tqs_bill_files WHERE bill_id = $1 ORDER BY uploaded_at DESC`, [req.params.id]),
      query(`SELECT h.*, u.name AS changed_by_name FROM tqs_bill_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.bill_id = $1 ORDER BY h.ts DESC`, [req.params.id]),
    ]);

    if (!bill.rows.length) return res.status(404).json({ error: 'Bill not found' });

    res.json({
      data: {
        ...bill.rows[0],
        bill_updates: updates.rows[0] || {},
        line_items:   items.rows,
        files:        files.rows,
        history:      history.rows,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /tqs/bills/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const allowed = [
      // Vendor & refs
      'vendor_name','vendor_id','po_id','grn_id','po_number','po_date',
      // Invoice
      'inv_number','inv_date','inv_month','received_date',
      // Bill meta
      'bill_type','work_desc','tax_mode','remarks',
      // Amounts & GST
      'basic_amount','cgst_pct','cgst_amt','sgst_pct','sgst_amt','igst_pct','igst_amt','gst_amount',
      // Transport
      'transport_charges','transport_gst_pct','transport_gst_amt','transport_desc',
      // Other charges
      'other_charges','other_charges_desc',
      // Credit note
      'credit_note_num','credit_note_val',
      // Grand total
      'total_amount',
    ];
    const fields = req.body;
    let sets = [], params = [req.params.id, req.user.company_id], i = 3;
    Object.keys(fields).forEach(k => {
      if (allowed.includes(k)) { sets.push(`${k} = $${i++}`); params.push(fields[k]); }
    });
    if (!sets.length) return res.status(400).json({ error: 'No valid fields' });
    sets.push(`updated_at = NOW()`);
    const r = await query(`UPDATE tqs_bills SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params);
    await logHistory(req.params.id, 'system', 'Bill updated', req.user.id);
    res.json({ data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tqs/bills/:id/stores ────────────────────────────────────────────
router.patch('/:id/stores', requireTqsStageAccess('stores'), async (req, res) => {
  try {
      const { store_recv_date, dc_number, vehicle_number, inspection_status, received_by, sent_to_ho_date, store_remarks } = req.body;
      await query(`
        UPDATE tqs_bill_updates SET
          store_recv_date=$1, dc_number=$2, vehicle_number=$3,
          inspection_status=$4, received_by=$5, sent_to_ho_date=$6, store_remarks=$7, updated_at=NOW()
        WHERE bill_id=$8
      `, [store_recv_date, dc_number, vehicle_number, inspection_status, received_by, sent_to_ho_date, store_remarks, req.params.id]);
    await query(`UPDATE tqs_bills SET workflow_status='document_controller', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await logHistory(
      req.params.id,
      'stores',
      `Stores receipt updated${sent_to_ho_date ? `, sent to HO: ${sent_to_ho_date}` : ''}`,
      req.user.id
    );
    await logHistory(req.params.id, 'system', 'Moved to Document Controller', req.user.id);
    res.json({ message: 'Stores updated and forwarded to Document Controller' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tqs/bills/:id/document-control
router.patch('/:id/document-control', requireTqsStageAccess('document_control'), async (req, res) => {
  try {
    const {
      ho_received_date,
      handed_over_qs_date,
      document_controller_remarks,
    } = req.body;

    await query(`
      UPDATE tqs_bill_updates SET
        ho_received_date=$1,
        handed_over_qs_date=$2,
        document_controller_remarks=$3,
        updated_at=NOW()
      WHERE bill_id=$4
    `, [ho_received_date || null, handed_over_qs_date || null, document_controller_remarks || null, req.params.id]);

    await query(`UPDATE tqs_bills SET workflow_status='qs', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await logHistory(
      req.params.id,
      'document_controller',
      `Document Controller updated${ho_received_date ? `, HO received: ${ho_received_date}` : ''}${handed_over_qs_date ? `, handed over to QS: ${handed_over_qs_date}` : ''}`,
      req.user.id
    );
    await logHistory(req.params.id, 'system', 'Moved to QS', req.user.id);
    res.json({ message: 'Document Controller updated and moved to QS' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /tqs/bills/:id/ra-summary ─────────────────────────────────────────
// Returns prior certified bills for the same vendor + PO (RA sequence context)
router.get('/:id/ra-summary', async (req, res) => {
  try {
    const cur = await query(
      `SELECT vendor_name, po_number, company_id FROM tqs_bills WHERE id=$1 AND is_deleted=FALSE`,
      [req.params.id]
    );
    if (!cur.rows.length) return res.status(404).json({ error: 'Bill not found' });
    const { vendor_name, po_number, company_id } = cur.rows[0];

    if (!vendor_name || !po_number) {
      return res.json({ data: { previous_bills: [], previous_certified_total: 0, suggested_ra_sequence: 1 } });
    }

    const prev = await query(`
      SELECT b.id, b.sl_number, b.inv_number, b.inv_date,
             u.ra_sequence, u.ra_bill_number, u.certified_net,
             u.cumulative_certified_amount, b.workflow_status
      FROM tqs_bills b
      LEFT JOIN tqs_bill_updates u ON u.bill_id = b.id
      WHERE b.vendor_name = $1
        AND b.po_number   = $2
        AND b.company_id  = $3
        AND b.id         != $4
        AND b.is_deleted  = FALSE
        AND b.workflow_status IN ('qs','accounts','paid')
      ORDER BY COALESCE(u.ra_sequence, 0) ASC, b.created_at ASC
    `, [vendor_name, po_number, company_id, req.params.id]);

    const previous_certified_total = prev.rows.reduce(
      (s, r) => s + parseFloat(r.certified_net || 0), 0
    );

    res.json({
      data: {
        previous_bills: prev.rows,
        previous_certified_total,
        suggested_ra_sequence: prev.rows.length + 1,
        vendor_name,
        po_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tqs/bills/:id/qs ────────────────────────────────────────────────
router.patch('/:id/qs', requireTqsStageAccess('qs'), async (req, res) => {
  try {
    const {
      qs_received_date, qs_certified_date, handed_over_accounts_date, qs_gross, qs_tax,
      advance_recovered = 0, credit_note_amt = 0,
      retention_money = 0, tds_deduction = 0, other_deductions = 0,
      qs_remarks,
      ra_sequence = 1, ra_bill_number, is_final_bill = false,
      qs_summary_template = [],
      qs_ra_items = [],
      cgst_pct: ra_cgst_pct = 9,
      sgst_pct: ra_sgst_pct = 9,
      igst_pct: ra_igst_pct = 0,
    } = req.body;

    const qs_total        = parseFloat(qs_gross || 0) + parseFloat(qs_tax || 0);
    const total_deductions = parseFloat(advance_recovered) + parseFloat(credit_note_amt) +
                             parseFloat(retention_money)   + parseFloat(tds_deduction) +
                             parseFloat(other_deductions);
    const certified_net   = qs_total - total_deductions;

    // ── Auto-calculate RA cumulative amounts ──────────────────────────────
    const cur = await query(
      `SELECT vendor_name, po_number, company_id FROM tqs_bills WHERE id=$1`,
      [req.params.id]
    );
    let previous_certified_amount = 0;
    if (cur.rows.length && cur.rows[0].vendor_name && cur.rows[0].po_number) {
      const { vendor_name, po_number, company_id } = cur.rows[0];
      const sumRes = await query(`
        SELECT COALESCE(SUM(u.certified_net), 0) AS total
        FROM tqs_bills b
        LEFT JOIN tqs_bill_updates u ON u.bill_id = b.id
        WHERE b.vendor_name = $1 AND b.po_number = $2
          AND b.company_id  = $3 AND b.id       != $4
          AND b.is_deleted  = FALSE
          AND b.workflow_status IN ('qs','accounts','paid')
      `, [vendor_name, po_number, company_id, req.params.id]);
      previous_certified_amount = parseFloat(sumRes.rows[0]?.total || 0);
    }
    const cumulative_certified_amount = previous_certified_amount + certified_net;
    const raNum = ra_bill_number || `RA-${ra_sequence}`;

    await query(`
      UPDATE tqs_bill_updates SET
        qs_received_date=$1, qs_certified_date=$2, qs_gross=$3, qs_tax=$4, qs_total=$5,
        advance_recovered=$6, credit_note_amt=$7, retention_money=$8,
        tds_deduction=$9, other_deductions=$10, total_deductions=$11,
        certified_net=$12, qs_remarks=$13,
        handed_over_accounts_date=$14,
        ra_sequence=$15, ra_bill_number=$16, is_final_bill=$17,
        previous_certified_amount=$18, cumulative_certified_amount=$19,
        qs_summary_template=$20,
        qs_ra_items=$21,
        ra_cgst_pct=$22, ra_sgst_pct=$23, ra_igst_pct=$24,
        updated_at=NOW()
      WHERE bill_id=$25
    `, [qs_received_date, qs_certified_date, qs_gross, qs_tax, qs_total,
        advance_recovered, credit_note_amt, retention_money,
        tds_deduction, other_deductions, total_deductions, certified_net,
        qs_remarks, handed_over_accounts_date || null,
        ra_sequence, raNum, is_final_bill,
        previous_certified_amount, cumulative_certified_amount,
        JSON.stringify(qs_summary_template),
        JSON.stringify(qs_ra_items),
        ra_cgst_pct, ra_sgst_pct, ra_igst_pct,
        req.params.id]);

    await query(`UPDATE tqs_bills SET workflow_status='accounts', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    await logHistory(req.params.id, 'qs',
      `QS certified (${raNum}) — Net: ₹${certified_net.toFixed(2)}, Cumulative: ₹${cumulative_certified_amount.toFixed(2)}${handed_over_accounts_date ? `, handed over to Accounts: ${handed_over_accounts_date}` : ''}`,
      req.user.id);
    await logHistory(req.params.id, 'system', 'Moved to Accounts', req.user.id);
    res.json({
      data: {
        certified_net, total_deductions, qs_total,
        ra_bill_number: raNum, ra_sequence,
        previous_certified_amount, cumulative_certified_amount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /tqs/bills/:id/payment-certificate ────────────────────────────────
router.post('/:id/payment-certificate', async (req, res) => {
  try {
    // Check if a PC already exists — regenerate only if requested
    const existing = await query(`SELECT pc_number FROM tqs_bill_updates WHERE bill_id=$1`, [req.params.id]);
    let pc_number = existing.rows[0]?.pc_number;
    if (!pc_number) {
      pc_number = await nextPCNumber();
      await query(
        `UPDATE tqs_bill_updates SET pc_number=$1, pc_generated_at=NOW(), updated_at=NOW() WHERE bill_id=$2`,
        [pc_number, req.params.id]
      );
      await logHistory(req.params.id, 'qs', `Payment Certificate generated: ${pc_number}`, req.user.id);
    }
    res.status(201).json({ data: { pc_number } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tqs/bills/:id/payment-certificate/sign ─────────────────────────
router.patch('/:id/payment-certificate/sign', async (req, res) => {
  try {
    const { stage, sig_img, signed_by } = req.body;
    const validStages = ['qs', 'pm', 'accts'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage. Use: qs, pm, accts' });
    }
    await query(`
      UPDATE tqs_bill_updates SET
        pc_${stage}_sig_img   = $1,
        pc_${stage}_signed_by = $2,
        pc_${stage}_signed_at = NOW(),
        updated_at = NOW()
      WHERE bill_id = $3
    `, [sig_img, signed_by || 'User', req.params.id]);
    await logHistory(req.params.id, stage,
      `Payment Certificate signed (${stage.toUpperCase()}) by ${signed_by || 'User'}`,
      req.user.id);
    res.json({ message: `Signed by ${stage}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tqs/bills/:id/payment ───────────────────────────────────────────
router.patch('/:id/accounts', requireTqsStageAccess('accounts'), async (req, res) => {
  try {
    const { accts_received_from_qs_date, accts_jv_date, accts_remarks } = req.body;

    await query(`
      UPDATE tqs_bill_updates SET
        accts_received_from_qs_date=$1,
        accts_jv_date=$2,
        accts_remarks=$3,
        updated_at=NOW()
      WHERE bill_id=$4
    `, [
      accts_received_from_qs_date || null,
      accts_jv_date || null,
      accts_remarks || null,
      req.params.id,
    ]);

    await query(`UPDATE tqs_bills SET workflow_status='procurement', updated_at=NOW() WHERE id=$1`, [req.params.id]);

    await logHistory(req.params.id, 'accounts',
      `Received from QS: ${accts_received_from_qs_date || '—'}, JV passed: ${accts_jv_date || '—'} → Procurement`,
      req.user.id);

    res.json({ data: { workflow_status: 'procurement' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/procurement', requireTqsStageAccess('procurement'), async (req, res) => {
  try {
    const {
      proc_received_from_accounts_date,
      proc_handed_over_to_accounts_date,
      procurement_remarks,
    } = req.body;

    await query(`
      UPDATE tqs_bill_updates SET
        proc_received_from_accounts_date=$1,
        proc_handed_over_to_accounts_date=$2,
        procurement_remarks=$3,
        updated_at=NOW()
      WHERE bill_id=$4
    `, [
      proc_received_from_accounts_date || null,
      proc_handed_over_to_accounts_date || null,
      procurement_remarks || null,
      req.params.id,
    ]);

    await query(`UPDATE tqs_bills SET workflow_status='accounts', updated_at=NOW() WHERE id=$1`, [req.params.id]);

    await logHistory(req.params.id, 'procurement',
      `Received from Accounts: ${proc_received_from_accounts_date || '—'}, Handed over to Accounts: ${proc_handed_over_to_accounts_date || '—'} → Accounts for payment`,
      req.user.id);

    res.json({ data: { workflow_status: 'accounts' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/payment', requireTqsStageAccess('payment'), async (req, res) => {
  try {
    const { paid_amount, payment_date, payment_mode, reference_number, bank_name } = req.body;

    const updRow = await query(
      `SELECT certified_net, paid_amount, tds_deduction FROM tqs_bill_updates WHERE bill_id=$1`,
      [req.params.id]
    );
    const certified = parseFloat(updRow.rows[0]?.certified_net || 0);
    const tds       = parseFloat(updRow.rows[0]?.tds_deduction || 0);
    const new_paid  = parseFloat(paid_amount || 0);
    const balance   = certified - new_paid;
    const status    = balance <= 0 ? 'paid' : new_paid > 0 ? 'partial' : 'pending';

    // Fetch the parent bill for project + vendor info
    const billRow = await query(`SELECT * FROM tqs_bills WHERE id=$1`, [req.params.id]);
    if (!billRow.rows.length) return res.status(404).json({ error: 'Bill not found' });
    const bill = billRow.rows[0];

    const result = await withTransaction(async (client) => {
      // 1. Update tqs_bill_updates
      await client.query(`
        UPDATE tqs_bill_updates SET
          paid_amount=$1,   balance_to_pay=$2,   payment_status=$3,
          payment_date=$4,
          payment_mode=$5,  reference_number=$6, bank_name=$7,
          updated_at=NOW()
        WHERE bill_id=$8
      `, [new_paid, Math.max(0, balance), status,
          payment_date || null,
          payment_mode || null, reference_number || null, bank_name || null,
          req.params.id]);

      // 2. Advance workflow status
      const newWorkflow = status === 'paid' ? 'paid' : 'accounts';
      await client.query(`UPDATE tqs_bills SET workflow_status=$1, updated_at=NOW() WHERE id=$2`,
        [newWorkflow, req.params.id]);

      // 3. Auto-create Finance payment record when amount > 0 and project exists
      let finance_payment_id = null;
      if (new_paid > 0 && payment_date && bill.project_id) {
        const payType = bill.bill_type === 'wo' ? 'subcontractor' : 'vendor';
        const netPaid = new_paid - tds;
        const fp = await client.query(`
          INSERT INTO payments
            (project_id, payment_type, entity_name,
             amount, tds_deducted, net_amount,
             payment_date, payment_mode, reference_number, bank_name,
             remarks, created_by, tqs_bill_id, source)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING id
        `, [
          bill.project_id, payType, bill.vendor_name,
          new_paid, tds, Math.max(0, netPaid),
          payment_date,
          payment_mode || 'bank_transfer',
          reference_number || null,
          bank_name || null,
          `TQS Bill ${bill.sl_number} — Inv: ${bill.inv_number || '—'}`,
          req.user.id, req.params.id, 'tqs',
        ]);
        finance_payment_id = fp.rows[0].id;
        // Back-link on tqs_bill_updates
        await client.query(
          `UPDATE tqs_bill_updates SET finance_payment_id=$1 WHERE bill_id=$2`,
          [finance_payment_id, req.params.id]
        );
      }

      return { paid_amount: new_paid, balance_to_pay: Math.max(0, balance), payment_status: status, finance_payment_id };
    });

    await logHistory(req.params.id, 'accounts',
      `Payment recorded ₹${new_paid} (${status})${result.finance_payment_id ? ' → Finance entry created' : ''}`,
      req.user.id);
    res.json({ data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /tqs/bills/:id/files ──────────────────────────────────────────────
router.post('/:id/files', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const local_url = `/uploads/tqs-bills/${req.params.id}/${req.file.filename}`;
    const localPath = req.file.path;

    const projectName = await getBillProjectName(req.params.id);

    // Try OneDrive upload
    let onedriveData = null;
    try {
      logger.info(`☁ Attempting OneDrive sync for: ${req.file.originalname}`);
      onedriveData = await uploadToOneDrive(localPath, req.file.originalname, 'Vendor Invoices', projectName);
      if (onedriveData) logger.info('✅ OneDrive sync successful');
      else logger.warn('⚠️ OneDrive sync skipped (not configured)');
    } catch (odErr) {
      logger.error('❌ OneDrive upload failed:', odErr.message);
    }

    const r = await query(`
      INSERT INTO tqs_bill_files (
        bill_id, file_name, file_size, file_type, local_url,
        onedrive_id, onedrive_url, onedrive_web_url, uploaded_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      req.params.id, req.file.originalname, req.file.size, req.file.mimetype, local_url,
      onedriveData?.onedrive_id || null,
      onedriveData?.onedrive_url || null,
      onedriveData?.onedrive_web_url || null,
      req.user.id
    ]);

    await logHistory(req.params.id, 'system', `File uploaded: ${req.file.originalname}`, req.user.id);

    res.status(201).json({
      data: r.rows[0],
      onedrive_synced: !!onedriveData,
      onedrive_configured: isConfigured(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /tqs/bills/:id/files/:fid ──────────────────────────────────────
router.post('/:id/files/:fid/sync-onedrive', async (req, res) => {
  try {
    const fileResult = await query(`
      SELECT f.*, b.company_id
      FROM tqs_bill_files f
      JOIN tqs_bills b ON b.id = f.bill_id
      WHERE f.id = $1 AND f.bill_id = $2 AND b.company_id = $3 AND b.is_deleted = FALSE
    `, [req.params.fid, req.params.id, req.user.company_id]);

    if (!fileResult.rows.length) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const fileRow = fileResult.rows[0];
    if (fileRow.onedrive_web_url) {
      return res.json({
        data: fileRow,
        onedrive_synced: true,
        onedrive_configured: isConfigured(),
        message: 'Attachment already synced to OneDrive',
      });
    }

    if (!isConfigured()) {
      return res.status(400).json({ error: 'OneDrive is not configured on the server' });
    }

    const localRelative = (fileRow.local_url || '').replace(/^\/+/, '');
    const localPath = path.join(__dirname, '../../', localRelative);
    if (!localRelative || !fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Local attachment file not found for sync' });
    }

    const projectName = await getBillProjectName(req.params.id);
    const onedriveData = await uploadToOneDrive(localPath, fileRow.file_name, 'Vendor Invoices', projectName);

    const updated = await query(`
      UPDATE tqs_bill_files
      SET onedrive_id = $1,
          onedrive_url = $2,
          onedrive_web_url = $3
      WHERE id = $4
      RETURNING *
    `, [
      onedriveData?.onedrive_id || null,
      onedriveData?.onedrive_url || null,
      onedriveData?.onedrive_web_url || null,
      req.params.fid,
    ]);

    await logHistory(req.params.id, 'system', `Attachment synced to OneDrive: ${fileRow.file_name}`, req.user.id);

    res.json({
      data: updated.rows[0],
      onedrive_synced: !!onedriveData,
      onedrive_configured: isConfigured(),
      message: 'Attachment synced to OneDrive',
    });
  } catch (err) {
    logger.error('OneDrive re-sync failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/files/:fid', async (req, res) => {
  try {
    const f = await query(`SELECT * FROM tqs_bill_files WHERE id=$1 AND bill_id=$2`, [req.params.fid, req.params.id]);
    if (f.rows.length && f.rows[0].local_url) {
      const fullPath = path.join(__dirname, '../../', f.rows[0].local_url);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await query(`DELETE FROM tqs_bill_files WHERE id=$1`, [req.params.fid]);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /tqs/bills/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await query(`UPDATE tqs_bills SET is_deleted=TRUE, updated_at=NOW() WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id]);
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
