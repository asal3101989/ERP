// src/routes/tqs-vendors.routes.js
// Unified vendor management — reads/writes the main `vendors` table.
// tqs_vendors legacy table is no longer written to; this file is kept as
// the TQS-facing endpoint so no frontend API URLs need to change.
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── Ensure extra columns exist on the main vendors table ─────────────────────
async function ensureVendorColumns() {
  const extras = [
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS trade_name    TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pincode       TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS trade_license TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS msme_reg      TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_branch   TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes         TEXT DEFAULT ''`,
  ];
  for (const sql of extras) {
    await query(sql).catch(() => {}); // ignore if column already exists
  }
}
ensureVendorColumns();

// ── GET /tqs/vendors — list from unified vendors table ───────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, vendor_type } = req.query;
    const cid = req.user.company_id;
    const params = [cid];
    let i = 2;

    let sql = `
      SELECT
        id,
        vendor_code,
        name,
        COALESCE(trade_name, '')   AS trade_name,
        vendor_type,
        contact_person,
        phone,
        email,
        address,
        city,
        state,
        COALESCE(pincode, '')      AS pincode,
        gstin,
        pan,
        COALESCE(trade_license, '') AS trade_license,
        COALESCE(msme_reg, '')     AS msme_reg,
        bank_name,
        account_number             AS bank_account,
        ifsc_code                  AS bank_ifsc,
        COALESCE(bank_branch, '')  AS bank_branch,
        COALESCE(notes, '')        AS notes,
        credit_days,
        is_active,
        created_at,
        updated_at
      FROM vendors
      WHERE company_id = $1 AND is_active = TRUE
    `;

    if (search) {
      sql += ` AND (name ILIKE $${i} OR gstin ILIKE $${i} OR contact_person ILIKE $${i} OR phone ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }
    if (vendor_type) {
      sql += ` AND vendor_type = $${i++}`;
      params.push(vendor_type);
    }

    sql += ' ORDER BY name ASC';

    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('tqs-vendors GET error:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// ── POST /tqs/vendors — create vendor in main vendors table ──────────────────
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const cid = req.user.company_id;
    const code = `VEN-${Date.now().toString().slice(-6)}`;

    const result = await query(`
      INSERT INTO vendors (
        company_id, vendor_code, name, trade_name, vendor_type,
        contact_person, phone, email,
        address, city, state, pincode,
        gstin, pan, trade_license, msme_reg,
        bank_name, account_number, ifsc_code, bank_branch,
        notes, credit_days
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      ) RETURNING
        id, vendor_code, name,
        COALESCE(trade_name,'')    AS trade_name,
        vendor_type, contact_person, phone, email,
        address, city, state,
        COALESCE(pincode,'')       AS pincode,
        gstin, pan,
        COALESCE(trade_license,'') AS trade_license,
        COALESCE(msme_reg,'')      AS msme_reg,
        bank_name,
        account_number             AS bank_account,
        ifsc_code                  AS bank_ifsc,
        COALESCE(bank_branch,'')   AS bank_branch,
        COALESCE(notes,'')         AS notes,
        credit_days, is_active, created_at
    `, [
      cid, code,
      d.name,
      d.trade_name       || '',
      d.vendor_type      || '',
      d.contact_person   || '',
      d.phone            || '',
      d.email            || '',
      d.address          || '',
      d.city             || '',
      d.state            || 'Karnataka',
      d.pincode          || '',
      d.gstin            || '',
      d.pan              || '',
      d.trade_license    || '',
      d.msme_reg         || '',
      d.bank_name        || '',
      d.bank_account     || '',   // stored in account_number column
      d.bank_ifsc        || '',   // stored in ifsc_code column
      d.bank_branch      || '',
      d.notes            || '',
      d.credit_days      || 30,
    ]);

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Vendor name already exists for this company' });
    console.error('tqs-vendors POST error:', err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// ── PUT /tqs/vendors/:id — update vendor in main vendors table ───────────────
router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    const cid = req.user.company_id;

    const result = await query(`
      UPDATE vendors SET
        name           = $1,
        trade_name     = $2,
        vendor_type    = $3,
        contact_person = $4,
        phone          = $5,
        email          = $6,
        address        = $7,
        city           = $8,
        state          = $9,
        pincode        = $10,
        gstin          = $11,
        pan            = $12,
        trade_license  = $13,
        msme_reg       = $14,
        bank_name      = $15,
        account_number = $16,
        ifsc_code      = $17,
        bank_branch    = $18,
        notes          = $19,
        credit_days    = $20,
        updated_at     = NOW()
      WHERE id = $21 AND company_id = $22
      RETURNING
        id, vendor_code, name,
        COALESCE(trade_name,'')    AS trade_name,
        vendor_type, contact_person, phone, email,
        address, city, state,
        COALESCE(pincode,'')       AS pincode,
        gstin, pan,
        COALESCE(trade_license,'') AS trade_license,
        COALESCE(msme_reg,'')      AS msme_reg,
        bank_name,
        account_number             AS bank_account,
        ifsc_code                  AS bank_ifsc,
        COALESCE(bank_branch,'')   AS bank_branch,
        COALESCE(notes,'')         AS notes,
        credit_days, is_active, updated_at
    `, [
      d.name,
      d.trade_name       || '',
      d.vendor_type      || '',
      d.contact_person   || '',
      d.phone            || '',
      d.email            || '',
      d.address          || '',
      d.city             || '',
      d.state            || 'Karnataka',
      d.pincode          || '',
      d.gstin            || '',
      d.pan              || '',
      d.trade_license    || '',
      d.msme_reg         || '',
      d.bank_name        || '',
      d.bank_account     || '',
      d.bank_ifsc        || '',
      d.bank_branch      || '',
      d.notes            || '',
      d.credit_days      || 30,
      req.params.id,
      cid,
    ]);

    if (!result.rows.length) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Vendor name already exists' });
    console.error('tqs-vendors PUT error:', err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// ── DELETE /tqs/vendors/:id — soft delete from main vendors table ────────────
router.delete('/:id', async (req, res) => {
  try {
    const cid = req.user.company_id;
    await query(
      `UPDATE vendors SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [req.params.id, cid]
    );
    res.json({ message: 'Vendor deactivated' });
  } catch (err) {
    console.error('tqs-vendors DELETE error:', err);
    res.status(500).json({ error: 'Failed to deactivate vendor' });
  }
});

module.exports = router;
