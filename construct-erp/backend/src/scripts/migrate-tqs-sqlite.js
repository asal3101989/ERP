/**
 * migrate-tqs-sqlite.js
 * Migrates data from the old TQS ERP SQLite database (tqs_erp.db) into
 * the PostgreSQL tqs_bills, tqs_bill_updates, tqs_bill_history, and
 * tqs_material_tracker tables.
 *
 * Run from the backend directory:
 *   node src/scripts/migrate-tqs-sqlite.js
 */

require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const { query, pool } = require('../config/database');

const SQLITE_PATH = path.resolve(
  __dirname,
  '../../../TQS TRACKER/final01042026/tqs_erp.db'
);

async function loadSQLite() {
  const initSqlJs = require(path.resolve(
    __dirname,
    '../../../TQS TRACKER/final01042026/node_modules/sql.js'
  ));
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(SQLITE_PATH);
  return new SQL.Database(buf);
}

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Map old tracker_type ('po'/'wo') to our bill_type
function billType(t) {
  if (!t) return 'po';
  const s = String(t).toLowerCase();
  if (s.includes('wo') || s.includes('work')) return 'wo';
  return 'po';
}

// Map old payment_status to our standard values
function payStatus(s) {
  if (!s) return 'pending';
  const v = s.toLowerCase();
  if (v === 'paid' || v === 'full') return 'paid';
  if (v === 'partial') return 'partial';
  return 'pending';
}

// Map old workflow stage to our workflow_status
function workflowStatus(row, upd) {
  if (upd?.payment_status === 'paid' || upd?.transferred === 1) return 'paid';
  if (upd?.accts_jv_date) return 'accounts';
  if (upd?.qs_certified_date) return 'qs';
  if (upd?.store_recv_date || upd?.store_handover_date) return 'stores';
  return 'pending';
}

// Null-safe date
function d(v) { return v && v !== '' ? v : null; }
// Null-safe float
function f(v) { return v != null && v !== '' ? parseFloat(v) || 0 : 0; }

async function run() {
  console.log('Loading SQLite database…');
  const db = await loadSQLite();

  const bills   = dbAll(db, 'SELECT * FROM bills   WHERE is_deleted = 0 OR is_deleted IS NULL');
  const updates = dbAll(db, 'SELECT * FROM bill_updates');
  const history = dbAll(db, 'SELECT * FROM bill_history');
  const mtItems = dbAll(db, 'SELECT * FROM material_tracker_items WHERE is_deleted = 0 OR is_deleted IS NULL');

  db.close();

  console.log(`Found: ${bills.length} bills, ${updates.length} updates, ${history.length} history rows, ${mtItems.length} material tracker items`);

  // Build lookup maps
  const updMap = {};
  updates.forEach(u => { updMap[u.sl] = u; });

  // ── Ensure tables exist ──────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS tqs_bills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID,
      project_id UUID,
      sl_number TEXT UNIQUE NOT NULL,
      vendor_id UUID,
      vendor_name TEXT,
      po_number TEXT,
      po_date DATE,
      inv_number TEXT,
      inv_date DATE,
      inv_month TEXT,
      received_date DATE,
      basic_amount NUMERIC(14,2) DEFAULT 0,
      cgst_pct NUMERIC(5,2) DEFAULT 0,
      cgst_amt NUMERIC(14,2) DEFAULT 0,
      sgst_pct NUMERIC(5,2) DEFAULT 0,
      sgst_amt NUMERIC(14,2) DEFAULT 0,
      igst_pct NUMERIC(5,2) DEFAULT 0,
      igst_amt NUMERIC(14,2) DEFAULT 0,
      gst_amount NUMERIC(14,2) DEFAULT 0,
      transport_charges NUMERIC(14,2) DEFAULT 0,
      other_charges NUMERIC(14,2) DEFAULT 0,
      total_amount NUMERIC(14,2) DEFAULT 0,
      bill_type TEXT DEFAULT 'po',
      workflow_status TEXT DEFAULT 'pending',
      remarks TEXT,
      is_deleted BOOLEAN DEFAULT FALSE,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tqs_bill_updates (
      bill_id UUID PRIMARY KEY REFERENCES tqs_bills(id) ON DELETE CASCADE,
      store_recv_date DATE,
      dc_number TEXT,
      vehicle_number TEXT,
      inspection_status TEXT,
      received_by TEXT,
      store_remarks TEXT,
      qs_received_date DATE,
      qs_certified_date DATE,
      qs_gross NUMERIC(14,2),
      qs_tax NUMERIC(14,2),
      qs_total NUMERIC(14,2),
      advance_recovered NUMERIC(14,2) DEFAULT 0,
      credit_note_amt NUMERIC(14,2) DEFAULT 0,
      retention_money NUMERIC(14,2) DEFAULT 0,
      tds_deduction NUMERIC(14,2) DEFAULT 0,
      other_deductions NUMERIC(14,2) DEFAULT 0,
      total_deductions NUMERIC(14,2) DEFAULT 0,
      certified_net NUMERIC(14,2),
      qs_remarks TEXT,
      accts_jv_date DATE,
      accts_remarks TEXT,
      payment_status TEXT DEFAULT 'pending',
      paid_amount NUMERIC(14,2) DEFAULT 0,
      balance_to_pay NUMERIC(14,2),
      payment_date DATE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tqs_bill_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id UUID REFERENCES tqs_bills(id) ON DELETE CASCADE,
      dept TEXT,
      action TEXT,
      changed_by UUID,
      ts TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tqs_material_tracker (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID,
      project_id UUID,
      tracker_no TEXT UNIQUE,
      material_description TEXT,
      unit TEXT,
      mr_qty NUMERIC(14,3),
      vendor_name TEXT,
      po_number TEXT,
      po_value NUMERIC(14,2),
      invoice_number TEXT,
      invoice_date DATE,
      invoice_qty NUMERIC(14,3),
      basic_amount NUMERIC(14,2),
      tds_deduction NUMERIC(14,2) DEFAULT 0,
      retention NUMERIC(14,2) DEFAULT 0,
      certified_amount NUMERIC(14,2),
      payment_status TEXT DEFAULT 'pending',
      payment_date DATE,
      remarks TEXT,
      workflow_status TEXT DEFAULT 'pending',
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Check for already-migrated bills ────────────────────────────────────
  const existing = await query(`SELECT sl_number FROM tqs_bills`);
  const existingSet = new Set(existing.rows.map(r => r.sl_number));
  console.log(`Already in PG: ${existingSet.size} bills`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const b of bills) {
    if (existingSet.has(b.sl)) { skipped++; continue; }

    const upd = updMap[b.sl] || {};
    const wf  = workflowStatus(b, upd);

    try {
      // Insert bill
      const res = await query(`
        INSERT INTO tqs_bills (
          sl_number, vendor_name, po_number, po_date, inv_number, inv_date,
          inv_month, received_date, basic_amount, cgst_pct, cgst_amt,
          sgst_pct, sgst_amt, igst_pct, igst_amt, gst_amount,
          transport_charges, other_charges, total_amount,
          bill_type, workflow_status, remarks,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
        )
        ON CONFLICT (sl_number) DO NOTHING
        RETURNING id
      `, [
        b.sl, b.vendor, b.po_number, d(b.po_date), b.inv_number, d(b.inv_date),
        b.inv_month, d(b.received_date),
        f(b.basic_amount), f(b.cgst_pct), f(b.cgst_amt),
        f(b.sgst_pct), f(b.sgst_amt), f(b.igst_pct), f(b.igst_amt),
        f(b.gst_amount), f(b.transport_charges), f(b.other_charges), f(b.total_amount),
        billType(b.tracker_type), wf, b.remarks,
        d(b.created_at) || new Date().toISOString(),
        d(b.updated_at) || new Date().toISOString(),
      ]);

      if (!res.rows.length) { skipped++; continue; }
      const billId = res.rows[0].id;

      // Insert bill_updates
      await query(`
        INSERT INTO tqs_bill_updates (
          bill_id, store_recv_date, dc_number, vehicle_number, inspection_status,
          received_by, store_remarks,
          qs_received_date, qs_certified_date,
          qs_gross, qs_tax, qs_total,
          advance_recovered, credit_note_amt, retention_money,
          tds_deduction, other_deductions, total_deductions, certified_net,
          qs_remarks, accts_jv_date, accts_remarks,
          payment_status, paid_amount, balance_to_pay, payment_date,
          updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
        )
        ON CONFLICT (bill_id) DO NOTHING
      `, [
        billId,
        d(upd.store_recv_date), upd.dc_number, upd.vehicle_number, upd.inspection_status,
        upd.received_by, upd.store_remarks,
        d(upd.qs_received_date), d(upd.qs_certified_date),
        f(upd.qs_gross), f(upd.qs_tax), f(upd.qs_total),
        f(upd.advance_recovered), f(upd.credit_note_amt), f(upd.retention_money),
        f(upd.tds_deduction), f(upd.other_deductions), f(upd.total_deductions), f(upd.certified_net),
        upd.qs_remarks, d(upd.accts_jv_date), upd.accts_remarks,
        payStatus(upd.payment_status), f(upd.paid_amount), f(upd.balance_to_pay), d(upd.payment_date),
        d(upd.updated_at) || new Date().toISOString(),
      ]);

      inserted++;
    } catch (err) {
      console.error(`  ERROR on bill ${b.sl}:`, err.message);
      errors++;
    }
  }

  console.log(`\nBills: inserted=${inserted}, skipped=${skipped}, errors=${errors}`);

  // ── Migrate history ──────────────────────────────────────────────────────
  let hInserted = 0, hSkipped = 0;
  const slToId = {};
  const idRows = await query(`SELECT id, sl_number FROM tqs_bills`);
  idRows.rows.forEach(r => { slToId[r.sl_number] = r.id; });

  for (const h of history) {
    const billId = slToId[h.sl];
    if (!billId) { hSkipped++; continue; }
    try {
      await query(`
        INSERT INTO tqs_bill_history (bill_id, dept, action, ts)
        VALUES ($1, $2, $3, $4)
      `, [billId, h.dept || 'system', h.action, d(h.ts) || new Date().toISOString()]);
      hInserted++;
    } catch (err) {
      hSkipped++;
    }
  }
  console.log(`History: inserted=${hInserted}, skipped=${hSkipped}`);

  // ── Migrate material tracker items ───────────────────────────────────────
  let mtInserted = 0, mtSkipped = 0, mtErrors = 0;
  const existingMT = await query(`SELECT tracker_no FROM tqs_material_tracker`);
  const existingMTSet = new Set(existingMT.rows.map(r => r.tracker_no));

  for (const mt of mtItems) {
    const tno = mt.tracker_no || `MT-LEGACY-${mt.id}`;
    if (existingMTSet.has(tno)) { mtSkipped++; continue; }
    try {
      await query(`
        INSERT INTO tqs_material_tracker (
          tracker_no, material_description, unit, mr_qty, vendor_name,
          po_number, po_value, invoice_number, invoice_date, invoice_qty,
          basic_amount, tds_deduction, retention, certified_amount,
          payment_status, workflow_status, remarks,
          created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        )
        ON CONFLICT (tracker_no) DO NOTHING
      `, [
        tno, mt.item_description, mt.unit, f(mt.mr_qty), mt.vendor_name,
        mt.po_no, f(mt.po_value_basic), mt.invoice_number, d(mt.invoice_date), f(mt.invoice_qty),
        f(mt.basic_amount), f(mt.tds_other_deduction), f(mt.retention),
        f(mt.amount_certified_by_qs_for_payment),
        payStatus(null), mt.workflow_status || 'pending', mt.remarks,
        d(mt.created_at) || new Date().toISOString(),
        d(mt.updated_at) || new Date().toISOString(),
      ]);
      mtInserted++;
    } catch (err) {
      console.error(`  MT ERROR on ${tno}:`, err.message);
      mtErrors++;
    }
  }
  console.log(`Material Tracker: inserted=${mtInserted}, skipped=${mtSkipped}, errors=${mtErrors}`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const totals = await query(`
    SELECT
      (SELECT COUNT(*) FROM tqs_bills) AS bills,
      (SELECT COUNT(*) FROM tqs_bill_updates) AS updates,
      (SELECT COUNT(*) FROM tqs_bill_history) AS history,
      (SELECT COUNT(*) FROM tqs_material_tracker) AS mt
  `);
  const t = totals.rows[0];
  console.log(`\n✅ PostgreSQL now has:`);
  console.log(`   tqs_bills:            ${t.bills}`);
  console.log(`   tqs_bill_updates:     ${t.updates}`);
  console.log(`   tqs_bill_history:     ${t.history}`);
  console.log(`   tqs_material_tracker: ${t.mt}`);

  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
