const express = require('express');

const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/', async (req, res) => {
  const { project_id, payment_type, from_date, to_date } = req.query;

  let sql = `
    SELECT pay.*, p.name AS project_name
    FROM payments pay
    JOIN projects p ON pay.project_id = p.id
    WHERE p.company_id = $1
  `;

  const params = [req.user.company_id];
  let index = 2;

  if (project_id) {
    sql += ` AND pay.project_id = $${index++}`;
    params.push(project_id);
  }

  if (payment_type) {
    sql += ` AND pay.payment_type = $${index++}`;
    params.push(payment_type);
  }

  if (from_date) {
    sql += ` AND pay.payment_date >= $${index++}`;
    params.push(from_date);
  }

  if (to_date) {
    sql += ` AND pay.payment_date <= $${index++}`;
    params.push(to_date);
  }

  sql += ' ORDER BY pay.payment_date DESC, pay.created_at DESC';

  const result = await query(sql, params);
  res.json({ data: result.rows, count: result.rowCount });
});

router.post('/', authorize('super_admin', 'admin', 'accountant'), async (req, res) => {
  const {
    project_id,
    payment_type,
    entity_name,
    entity_pan,
    invoice_id,
    amount,
    tds_deducted,
    payment_date,
    payment_mode,
    reference_number,
    bank_name,
    remarks,
    cost_head,
  } = req.body;

  const projectCheck = await query(
    `SELECT 1 FROM projects WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [project_id, req.user.company_id]
  );

  if (!projectCheck.rowCount) {
    return res.status(400).json({ error: 'Invalid project for this company' });
  }

  const grossAmount = parseFloat(amount || 0);
  const tdsAmount = parseFloat(tds_deducted || 0);
  const netAmount = grossAmount - tdsAmount;

  const result = await query(
    `INSERT INTO payments (
      project_id, payment_type, entity_name, entity_pan, invoice_id, amount,
      tds_deducted, net_amount, payment_date, payment_mode, reference_number,
      bank_name, remarks, created_by, cost_head
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15
    )
    RETURNING *`,
    [
      project_id,
      payment_type,
      entity_name,
      entity_pan,
      invoice_id,
      grossAmount,
      tdsAmount,
      netAmount,
      payment_date,
      payment_mode,
      reference_number,
      bank_name,
      remarks,
      req.user.id,
      cost_head || null,
    ]
  );

  res.status(201).json({ data: result.rows[0] });
});

router.delete('/:id', authorize('super_admin', 'admin', 'accountant'), async (req, res) => {
  const existing = await query(
    `SELECT pay.id
     FROM payments pay
     JOIN projects p ON pay.project_id = p.id
     WHERE pay.id = $1 AND p.company_id = $2
     LIMIT 1`,
    [req.params.id, req.user.company_id]
  );

  if (!existing.rowCount) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  await query('DELETE FROM payments WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.get('/tds-report', async (req, res) => {
  const { year } = req.query;
  const reportYear = year || new Date().getFullYear();

  const report = await query(
    `SELECT
       entity_name,
       entity_pan,
       SUM(amount) AS gross_amount,
       SUM(tds_deducted) AS tds_deducted,
       SUM(net_amount) AS net_paid,
       COUNT(*) AS transaction_count,
       payment_mode,
       MIN(payment_date) AS first_payment,
       MAX(payment_date) AS last_payment
     FROM payments pay
     JOIN projects p ON pay.project_id = p.id
     WHERE p.company_id = $1
       AND pay.tds_deducted > 0
       AND EXTRACT(YEAR FROM pay.payment_date) = $2
     GROUP BY entity_name, entity_pan, payment_mode
     ORDER BY tds_deducted DESC`,
    [req.user.company_id, reportYear]
  );

  const totals = await query(
    `SELECT
       SUM(tds_deducted) AS total_tds,
       SUM(amount) AS total_gross
     FROM payments pay
     JOIN projects p ON pay.project_id = p.id
     WHERE p.company_id = $1
       AND EXTRACT(YEAR FROM pay.payment_date) = $2`,
    [req.user.company_id, reportYear]
  );

  res.json({ data: report.rows, totals: totals.rows[0] });
});

module.exports = router;
