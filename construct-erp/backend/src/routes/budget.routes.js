// src/routes/budget.routes.js
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
const router = express.Router();
router.use(authenticate);

// GET /budget?project_id=xxx
// Returns budget lines with actual_spend auto-calculated from payments table
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const proj = await query(
      `SELECT id FROM projects WHERE id=$1 AND company_id=$2`,
      [project_id, req.user.company_id]
    );
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' });

    // Budget lines
    const budget = await query(
      `SELECT * FROM budget_items WHERE project_id=$1 ORDER BY created_at`,
      [project_id]
    );

    // Actual spend from payments grouped by cost_head for this project
    const actuals = await query(
      `SELECT cost_head, SUM(net_amount) AS actual_spend
       FROM payments
       WHERE project_id=$1 AND cost_head IS NOT NULL AND cost_head <> ''
       GROUP BY cost_head`,
      [project_id]
    );

    const actualMap = {};
    actuals.rows.forEach(r => { actualMap[r.cost_head] = parseFloat(r.actual_spend || 0); });

    // Merge actual spend into budget lines
    const rows = budget.rows.map(b => ({
      ...b,
      actual_amount: actualMap[b.cost_head] || 0,
    }));

    // Also return cost heads that have spend but no budget line (unbudgeted)
    const budgetedHeads = new Set(budget.rows.map(b => b.cost_head));
    const unbudgeted = actuals.rows
      .filter(r => !budgetedHeads.has(r.cost_head))
      .map(r => ({
        id: null,
        project_id,
        cost_head: r.cost_head,
        budgeted_amount: 0,
        actual_amount: parseFloat(r.actual_spend || 0),
        remarks: 'No budget allocated',
        unbudgeted: true,
      }));

    res.json({ data: [...rows, ...unbudgeted] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /budget
router.post('/', authorize('super_admin', 'admin', 'project_manager', 'accountant'), async (req, res) => {
  try {
    const { project_id, cost_head, budgeted_amount, remarks } = req.body;
    if (!project_id || !cost_head || !budgeted_amount)
      return res.status(400).json({ error: 'project_id, cost_head, budgeted_amount are required' });

    const proj = await query(
      `SELECT id FROM projects WHERE id=$1 AND company_id=$2`,
      [project_id, req.user.company_id]
    );
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' });

    const result = await query(
      `INSERT INTO budget_items (project_id, cost_head, budgeted_amount, actual_amount, remarks)
       VALUES ($1,$2,$3,0,$4) RETURNING *`,
      [project_id, cost_head, budgeted_amount, remarks]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /budget/:id
router.put('/:id', authorize('super_admin', 'admin', 'project_manager', 'accountant'), async (req, res) => {
  try {
    const { cost_head, budgeted_amount, remarks } = req.body;
    const check = await query(
      `SELECT b.id FROM budget_items b JOIN projects p ON b.project_id=p.id
       WHERE b.id=$1 AND p.company_id=$2`,
      [req.params.id, req.user.company_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });

    const result = await query(
      `UPDATE budget_items
         SET cost_head=COALESCE($1,cost_head),
             budgeted_amount=COALESCE($2,budgeted_amount),
             remarks=COALESCE($3,remarks),
             updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [cost_head, budgeted_amount, remarks, req.params.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /budget/:id
router.delete('/:id', authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const check = await query(
      `SELECT b.id FROM budget_items b JOIN projects p ON b.project_id=p.id
       WHERE b.id=$1 AND p.company_id=$2`,
      [req.params.id, req.user.company_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });
    await query(`DELETE FROM budget_items WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
