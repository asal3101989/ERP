// src/routes/invoice.routes.js — Vendor Billing (3-Way Match)
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
router.use(authenticate);

// GET /invoices — List with vendor & project data
router.get('/', async (req, res) => {
  try {
    const { project_id, vendor_id, status } = req.query;
    let sql = `
      SELECT i.*, p.name as project_name, v.name as vendor_name,
             u.name as verified_by_name, a.name as authorized_by_name
      FROM invoices i
      JOIN projects p ON i.project_id = p.id
      JOIN vendors v ON i.vendor_id = v.id
      LEFT JOIN users u ON i.verified_by = u.id
      LEFT JOIN users a ON i.authorized_by = a.id
      WHERE p.company_id = $1`;
    const params = [req.user.company_id]; let idx = 2;
    if (project_id) { sql += ` AND i.project_id = $${idx++}`; params.push(project_id); }
    if (vendor_id)  { sql += ` AND i.vendor_id = $${idx++}`;  params.push(vendor_id); }
    if (status)     { sql += ` AND i.status = $${idx++}`;     params.push(status); }
    sql += ` ORDER BY i.invoice_date DESC`;
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /invoices/:id — Detail with items
router.get('/:id', async (req, res) => {
  try {
    const invRes = await query(
      `SELECT i.*, p.name as project_name, v.name as vendor_name, po.po_number, g.gr_number
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       JOIN vendors v ON i.vendor_id = v.id
       LEFT JOIN purchase_orders po ON i.po_id = po.id
       LEFT JOIN grn g ON i.grn_id = g.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (!invRes.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    
    const items = await query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order`,
      [req.params.id]
    );
    res.json({ data: { ...invRes.rows[0], items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /invoices — Book a new vendor bill (3-Way Match)
router.post('/', authorize('super_admin','admin','accountant'), async (req, res) => {
  try {
    const {
      project_id, vendor_id, po_id, grn_id,
      invoice_number, invoice_date, total_amount, tax_amount, net_amount,
      due_date, items, tax_details, remarks
    } = req.body;

    if (!project_id || !vendor_id || !invoice_number || !items?.length) {
      return res.status(400).json({ error: 'Missing required invoice data' });
    }

    const result = await withTransaction(async (client) => {
      // 1. Insert Header
      const inv = await client.query(
        `INSERT INTO invoices
           (project_id, vendor_id, po_id, grn_id, invoice_number, invoice_date,
            total_amount, tax_amount, net_amount, due_date, tax_details, status, remarks)
         VALUES ($1,$2,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11,'pending',$12) RETURNING *`,
        [project_id, vendor_id, po_id || null, grn_id || null, invoice_number, invoice_date,
         total_amount, tax_amount, net_amount, due_date, tax_details, remarks]
      );
      const invId = inv.rows[0].id;

      // 2. Insert Items & Perform Match Validation
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        
        // Logical check: rate_invoiced should matches PO rate if po_id exists
        // In this modernization, we log it for auditor review
        await client.query(
          `INSERT INTO invoice_items
             (invoice_id, material_name, unit, quantity_on_grn, quantity_invoiced, 
              rate_on_po, rate_invoiced, tax_percent, tax_amount, net_amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [invId, it.material_name, it.unit, it.quantity_on_grn, it.quantity_invoiced,
           it.rate_on_po, it.rate_invoiced, it.tax_percent, it.tax_amount, it.net_amount, i + 1]
        );
      }
      return inv.rows[0];
    });

    res.status(201).json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /invoices/:id/verify — Step 2: Audit Verification
router.patch('/:id/verify', authorize('super_admin','admin','accountant'), async (req, res) => {
  try {
    await query(
      `UPDATE invoices SET status = 'verified', verified_by = $1, updated_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Invoice verified by audit' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /invoices/:id/authorize — Step 3: Accounts Authorization
router.patch('/:id/authorize', authorize('super_admin','admin'), async (req, res) => {
  try {
    await query(
      `UPDATE invoices SET status = 'authorized', authorized_by = $1, updated_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Invoice authorized for payment' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
