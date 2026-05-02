// src/routes/poAmendment.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

const ensureSchema = async () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS po_amendments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
      vendor_id UUID REFERENCES vendors(id),
      amendment_no TEXT NOT NULL,
      amendment_type TEXT NOT NULL,
      description TEXT NOT NULL,
      value_impact NUMERIC(15,2) DEFAULT 0,
      impact_type TEXT NOT NULL DEFAULT 'none' CHECK (impact_type IN ('increase','decrease','none')),
      raised_by TEXT,
      amendment_date DATE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id)`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS amendment_no TEXT`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS amendment_type TEXT`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS value_impact NUMERIC(15,2) DEFAULT 0`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS impact_type TEXT DEFAULT 'none'`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS raised_by TEXT`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS amendment_date DATE`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE po_amendments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
  ];

  for (const sql of statements) {
    await query(sql).catch(() => {});
  }
};
ensureSchema();

router.get('/', async (req, res) => {
  try {
    const { search, status, amendment_type, project_id } = req.query;
    const params = [req.user.company_id];
    let i = 2;
    let sql = `
      SELECT a.*,
             po.po_number,
             po.serial_no_formatted,
             p.name AS project_name,
             v.name AS vendor_name,
             cu.name AS created_by_name,
             au.name AS approved_by_name
      FROM po_amendments a
      JOIN purchase_orders po ON a.po_id = po.id
      JOIN projects p ON po.project_id = p.id
      LEFT JOIN vendors v ON a.vendor_id = v.id
      LEFT JOIN users cu ON a.created_by = cu.id
      LEFT JOIN users au ON a.approved_by = au.id
      WHERE a.company_id = $1
    `;
    if (project_id) { sql += ` AND po.project_id = $${i++}`; params.push(project_id); }
    if (status) { sql += ` AND a.status = $${i++}`; params.push(status); }
    if (amendment_type) { sql += ` AND a.amendment_type = $${i++}`; params.push(amendment_type); }
    if (search) {
      sql += ` AND (
        po.po_number ILIKE $${i} OR
        po.serial_no_formatted ILIKE $${i} OR
        COALESCE(v.name,'') ILIKE $${i} OR
        COALESCE(a.amendment_no,'') ILIKE $${i} OR
        COALESCE(a.description,'') ILIKE $${i} OR
        COALESCE(a.raised_by,'') ILIKE $${i}
      )`;
      params.push(`%${search}%`);
      i++;
    }
    sql += ' ORDER BY a.amendment_date DESC NULLS LAST, a.created_at DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('admin', 'procurement_manager'), async (req, res) => {
  try {
    const {
      po_id,
      amendment_type,
      description,
      value_impact = 0,
      impact_type = 'none',
      raised_by = '',
      amendment_date = null,
    } = req.body;

    if (!po_id || !amendment_type || !description) {
      return res.status(400).json({ error: 'po_id, amendment_type and description are required' });
    }

    const poRes = await query(
      `SELECT po.id, po.vendor_id, p.project_code
       FROM purchase_orders po
       JOIN projects p ON po.project_id = p.id
       WHERE po.id = $1 AND p.company_id = $2`,
      [po_id, req.user.company_id]
    );
    if (!poRes.rows.length) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    const countRes = await query(
      `SELECT COUNT(*)::int AS count FROM po_amendments WHERE company_id = $1`,
      [req.user.company_id]
    );
    const seq = String(countRes.rows[0].count + 1).padStart(3, '0');
    const amendment_no = `AMD-${new Date().getFullYear()}-${seq}`;

    const insertRes = await query(
      `INSERT INTO po_amendments (
        company_id, po_id, vendor_id, amendment_no, amendment_type, description,
        value_impact, impact_type, raised_by, amendment_date, status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)
      RETURNING *`,
      [
        req.user.company_id,
        po_id,
        poRes.rows[0].vendor_id,
        amendment_no,
        amendment_type,
        description,
        Number(value_impact) || 0,
        impact_type,
        raised_by,
        amendment_date,
        req.user.id,
      ]
    );

    res.status(201).json({ data: insertRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/approve', authorize('admin', 'procurement_manager'), async (req, res) => {
  try {
    const r = await query(
      `UPDATE po_amendments
       SET status = 'approved',
           approved_by = $1,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND company_id = $3
       RETURNING *`,
      [req.user.id, req.params.id, req.user.company_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Amendment not found' });
    res.json({ data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/reject', authorize('admin', 'procurement_manager'), async (req, res) => {
  try {
    const r = await query(
      `UPDATE po_amendments
       SET status = 'rejected',
           updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [req.params.id, req.user.company_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Amendment not found' });
    res.json({ data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize('admin', 'procurement_manager'), async (req, res) => {
  try {
    const r = await query(
      `DELETE FROM po_amendments WHERE id = $1 AND company_id = $2 RETURNING id`,
      [req.params.id, req.user.company_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Amendment not found' });
    res.json({ message: 'Amendment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
