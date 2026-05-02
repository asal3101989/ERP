// src/routes/quotation.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

// Auto-migrate: add cs_status to material_requisitions, mrs_id to quotations table
(async () => {
  try {
    const alters = [
      // CS workflow columns on material_requisitions
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_status TEXT DEFAULT 'pending_entry'`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_verified_by UUID`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_verified_at TIMESTAMPTZ`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_checked_by UUID`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_checked_at TIMESTAMPTZ`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_approved_by UUID`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_approved_at TIMESTAMPTZ`,
      `ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS cs_selected_vendor_id UUID`,
      // Add mrs_id to quotations (quotation system now references MRS, not indents)
      `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS mrs_id UUID`,
      // Add mrs_item_id to quotation_items
      `ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS mrs_item_id UUID`,
      // Make unit_rate nullable (it was per-item, not per-header)
      `ALTER TABLE quotations ALTER COLUMN unit_rate DROP NOT NULL`,
    ];
    for (const sql of alters) await query(sql);
  } catch (e) {
    console.warn('[quotation] migration skipped:', e.message);
  }
})();

// GET /quotations?mrs_id=
router.get('/', async (req, res) => {
  try {
    const { mrs_id } = req.query;
    let sql = `
      SELECT q.*, v.name AS vendor_name, v.contact_person, mr.mrs_number, mr.serial_no_formatted
      FROM quotations q
      LEFT JOIN vendors v ON q.vendor_id = v.id
      LEFT JOIN material_requisitions mr ON q.mrs_id = mr.id
      WHERE q.company_id = $1
    `;
    const params = [req.user.company_id];
    if (mrs_id) { sql += ` AND q.mrs_id = $2`; params.push(mrs_id); }
    sql += ' ORDER BY q.created_at DESC';
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /quotations/comparison/:mrsId
router.get('/comparison/:mrsId', async (req, res) => {
  try {
    const { mrsId } = req.params;

    // 1. Get MRS header + project info
    const mrsR = await query(
      `SELECT mr.*, p.name AS project_name, p.project_code, u.name AS raised_by_name
       FROM material_requisitions mr
       JOIN projects p ON mr.project_id = p.id
       LEFT JOIN users u ON mr.raised_by = u.id
       WHERE mr.id = $1 AND p.company_id = $2`,
      [mrsId, req.user.company_id]
    );
    if (!mrsR.rows.length) return res.status(404).json({ error: 'MRS not found' });
    const mrs = mrsR.rows[0];

    // 2. Get MRS items
    const itemsR = await query(
      `SELECT * FROM mrs_items WHERE mrs_id = $1 ORDER BY sort_order`,
      [mrsId]
    );
    const items = itemsR.rows;

    // 3. Get all quotations for this MRS (LEFT JOIN so missing vendor rows still appear)
    const quotesR = await query(
      `SELECT q.*,
              COALESCE(v.name, 'Unknown Vendor') AS vendor_name,
              COALESCE(v.id,   q.vendor_id)      AS vendor_id
       FROM quotations q
       LEFT JOIN vendors v ON q.vendor_id = v.id
       WHERE q.mrs_id = $1 AND q.company_id = $2
       ORDER BY q.created_at`,
      [mrsId, req.user.company_id]
    );
    const quotes = quotesR.rows;

    // 4. For each quote, get its items (linked by mrs_item_id)
    const matrix = [];
    for (const q of quotes) {
      const qItemsR = await query(
        `SELECT * FROM quotation_items WHERE quotation_id = $1`,
        [q.id]
      );
      q.items = qItemsR.rows;
      matrix.push(q);
    }

    // 5. Check if a PO was already raised for this MRS
    const poR = await query(
      `SELECT id, po_number, serial_no_formatted, status, created_at
       FROM purchase_orders
       WHERE mrs_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [mrsId]
    );
    const existingPO = poR.rows[0] || null;

    res.json({
      data: {
        indent: { ...mrs, indent_number: mrs.serial_no_formatted || mrs.mrs_number },
        items,
        vendors: matrix,
        existingPO,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /quotations — register a vendor quote for an MRS
router.post('/', async (req, res) => {
  try {
    const { mrs_id, vendor_id, delivery_days, payment_terms, notes, items } = req.body;

    if (!mrs_id || !vendor_id || !items?.length) {
      return res.status(400).json({ error: 'mrs_id, vendor_id and items are required' });
    }

    // Verify MRS belongs to this company
    const mrsCheck = await query(
      `SELECT mr.id FROM material_requisitions mr
       JOIN projects p ON mr.project_id = p.id
       WHERE mr.id = $1 AND p.company_id = $2`,
      [mrs_id, req.user.company_id]
    );
    if (!mrsCheck.rows.length) {
      return res.status(404).json({ error: 'MRS not found or access denied' });
    }

    const result = await withTransaction(async (client) => {
      // Generate quotation number
      const yr = new Date().getFullYear();
      const countRes = await client.query(
        'SELECT COUNT(*) FROM quotations WHERE company_id = $1',
        [req.user.company_id]
      );
      const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
      const quotation_number = `QT/${yr}/${seq}`;

      // Insert quotation header
      const hRes = await client.query(
        `INSERT INTO quotations (company_id, mrs_id, vendor_id, quotation_number, delivery_days, payment_terms, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.user.company_id, mrs_id, vendor_id, quotation_number, delivery_days, payment_terms, notes]
      );
      const qId = hRes.rows[0].id;

      // Insert quotation items
      for (const it of items) {
        await client.query(
          `INSERT INTO quotation_items (quotation_id, mrs_item_id, rate, discount_percent, gst_rate, remarks)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [qId, it.mrs_item_id, it.rate, it.discount_percent || 0, it.gst_rate || 18, it.remarks]
        );
      }

      // Advance MRS cs_status from pending_entry → pending_verification
      await client.query(
        `UPDATE material_requisitions
         SET cs_status = 'pending_verification', updated_at = NOW()
         WHERE id = $1 AND cs_status = 'pending_entry'`,
        [mrs_id]
      );

      return hRes.rows[0];
    });

    res.status(201).json({ data: result });
  } catch (err) {
    console.error('Quotation create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CS Approval Stages — all update material_requisitions.cs_status
router.patch('/comparison/:mrsId/verify', async (req, res) => {
  try {
    const r = await query(
      `UPDATE material_requisitions
       SET cs_status = 'pending_finance', cs_verified_by = $1, cs_verified_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND cs_status = 'pending_verification'
       RETURNING id`,
      [req.user.id, req.params.mrsId]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'Invalid status for verify' });
    res.json({ message: 'CS Verification completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/comparison/:mrsId/check', async (req, res) => {
  try {
    const r = await query(
      `UPDATE material_requisitions
       SET cs_status = 'pending_approval', cs_checked_by = $1, cs_checked_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND cs_status = 'pending_finance'
       RETURNING id`,
      [req.user.id, req.params.mrsId]
    );
    if (!r.rows.length) return res.status(400).json({ error: 'Invalid status for check' });
    res.json({ message: 'CS Finance check completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/comparison/:mrsId/approve', async (req, res) => {
  try {
    const { selected_vendor_id } = req.body;
    if (!selected_vendor_id) return res.status(400).json({ error: 'Winning vendor selection required' });

    await withTransaction(async (client) => {
      const r = await client.query(
        `UPDATE material_requisitions
         SET cs_status = 'approved', cs_approved_by = $1, cs_approved_at = NOW(),
             cs_selected_vendor_id = $2, updated_at = NOW()
         WHERE id = $3 AND cs_status = 'pending_approval'
         RETURNING id`,
        [req.user.id, selected_vendor_id, req.params.mrsId]
      );
      if (!r.rows.length) throw new Error('Invalid status for MD approval');

      // Mark selected quotation
      await client.query(
        `UPDATE quotations SET is_selected = true  WHERE mrs_id = $1 AND vendor_id = $2`,
        [req.params.mrsId, selected_vendor_id]
      );
      await client.query(
        `UPDATE quotations SET is_selected = false WHERE mrs_id = $1 AND vendor_id != $2`,
        [req.params.mrsId, selected_vendor_id]
      );
    });

    res.json({ message: 'CS Approved and Vendor Selected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
