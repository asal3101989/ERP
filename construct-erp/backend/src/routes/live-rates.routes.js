// src/routes/live-rates.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// ─── Auto-create benchmark table ─────────────────────────────────────────────
const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS material_rate_benchmarks (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id    UUID,
      material_name TEXT NOT NULL,
      category      TEXT,
      unit          TEXT,
      benchmark_rate      NUMERIC(14,2),
      min_acceptable      NUMERIC(14,2),
      max_acceptable      NUMERIC(14,2),
      remarks       TEXT,
      updated_by    UUID,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE material_rate_benchmarks ADD COLUMN IF NOT EXISTS min_acceptable NUMERIC(14,2)`);
  await query(`ALTER TABLE material_rate_benchmarks ADD COLUMN IF NOT EXISTS max_acceptable NUMERIC(14,2)`);
};

ensureSchema().catch((err) => console.error('[live-rates] schema init error:', err.message));

// ─── GET / — Combined rate data from all sources ──────────────────────────────
router.get('/', async (req, res) => {
  const companyId = req.user.company_id;

  // Source 1: Inventory (primary)
  const invResult = await query(
    `SELECT
       'inventory'                                               AS source_type,
       i.id                                                      AS source_id,
       i.material_name,
       COALESCE(NULLIF(TRIM(i.category), ''), 'Uncategorized')  AS category,
       i.unit,
       i.unit_rate                                               AS rate,
       i.closing_stock                                           AS stock_qty,
       i.opening_stock,
       i.unit_rate * i.closing_stock                            AS stock_value,
       i.last_updated                                            AS rate_date,
       p.name                                                    AS project_name,
       NULL::TEXT                                                AS vendor_name,
       NULL::TEXT                                                AS doc_ref,
       i.reorder_level,
       i.minimum_level
     FROM inventory i
     JOIN projects p ON p.id = i.project_id
     WHERE p.company_id = $1 AND i.unit_rate > 0
     ORDER BY i.category, i.material_name`,
    [companyId]
  );

  // Source 2: PO items
  const poResult = await query(
    `SELECT
       'po'                         AS source_type,
       pi.id                        AS source_id,
       pi.material_name,
       'Purchase Order'             AS category,
       pi.unit,
       pi.rate,
       pi.quantity                  AS stock_qty,
       0                            AS opening_stock,
       pi.rate * pi.quantity        AS stock_value,
       po.po_date                   AS rate_date,
       p.name                       AS project_name,
       v.name                       AS vendor_name,
       po.po_number                 AS doc_ref,
       0                            AS reorder_level,
       0                            AS minimum_level
     FROM po_items pi
     JOIN purchase_orders po ON po.id = pi.po_id
     JOIN projects p         ON p.id  = po.project_id
     LEFT JOIN vendors v     ON v.id  = po.vendor_id
     WHERE p.company_id = $1 AND pi.rate > 0`,
    [companyId]
  );

  const rates = [...invResult.rows, ...poResult.rows];

  // Build summary
  const totalItems = rates.length;
  const totalValue = rates.reduce((acc, r) => acc + parseFloat(r.stock_value || 0), 0);

  // Category rollup
  const catMap = {};
  rates.forEach((r) => {
    const cat = r.category || 'Uncategorized';
    if (!catMap[cat]) catMap[cat] = { category: cat, count: 0, total_value: 0, rate_sum: 0 };
    catMap[cat].count += 1;
    catMap[cat].total_value += parseFloat(r.stock_value || 0);
    catMap[cat].rate_sum += parseFloat(r.rate || 0);
  });
  const categories = Object.values(catMap).map((c) => ({
    category: c.category,
    count: c.count,
    total_value: Math.round(c.total_value * 100) / 100,
    avg_rate: c.count > 0 ? Math.round((c.rate_sum / c.count) * 100) / 100 : 0,
  }));

  // Top 5 by stock value
  const top_by_value = [...rates]
    .sort((a, b) => parseFloat(b.stock_value || 0) - parseFloat(a.stock_value || 0))
    .slice(0, 5)
    .map((r) => ({
      material_name: r.material_name,
      category: r.category,
      unit: r.unit,
      rate: r.rate,
      stock_qty: r.stock_qty,
      stock_value: r.stock_value,
    }));

  res.json({
    data: {
      rates,
      summary: {
        total_items: totalItems,
        total_value: Math.round(totalValue * 100) / 100,
        categories,
        top_by_value,
      },
    },
  });
});

// ─── GET /benchmarks — List all benchmarks for the company ───────────────────
router.get('/benchmarks', async (req, res) => {
  const companyId = req.user.company_id;
  const result = await query(
    `SELECT * FROM material_rate_benchmarks WHERE company_id = $1 ORDER BY category, material_name`,
    [companyId]
  );
  res.json({ data: result.rows });
});

// ─── POST /benchmarks — Upsert a benchmark ────────────────────────────────────
router.post('/benchmarks', async (req, res) => {
  const companyId = req.user.company_id;
  const userId = req.user.id;
  const { material_name, category, unit, benchmark_rate, min_acceptable, max_acceptable, remarks } = req.body;

  if (!material_name || benchmark_rate == null) {
    return res.status(400).json({ error: 'material_name and benchmark_rate are required' });
  }

  // Check if one already exists for this company + material (case-insensitive)
  const existing = await query(
    `SELECT id FROM material_rate_benchmarks WHERE company_id = $1 AND LOWER(material_name) = LOWER($2)`,
    [companyId, material_name]
  );

  let result;
  if (existing.rows.length > 0) {
    result = await query(
      `UPDATE material_rate_benchmarks
         SET category = $1, unit = $2, benchmark_rate = $3, min_acceptable = $4,
             max_acceptable = $5, remarks = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [category, unit, benchmark_rate, min_acceptable, max_acceptable, remarks, userId, existing.rows[0].id]
    );
  } else {
    result = await query(
      `INSERT INTO material_rate_benchmarks
         (company_id, material_name, category, unit, benchmark_rate, min_acceptable, max_acceptable, remarks, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [companyId, material_name, category, unit, benchmark_rate, min_acceptable, max_acceptable, remarks, userId]
    );
  }

  res.status(existing.rows.length > 0 ? 200 : 201).json({ data: result.rows[0] });
});

// ─── DELETE /benchmarks/:id — Remove a benchmark ─────────────────────────────
router.delete('/benchmarks/:id', async (req, res) => {
  const companyId = req.user.company_id;
  const { id } = req.params;

  const result = await query(
    `DELETE FROM material_rate_benchmarks WHERE id = $1 AND company_id = $2 RETURNING id`,
    [id, companyId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Benchmark not found' });
  }

  res.json({ message: 'Benchmark deleted', id });
});

module.exports = router;
