// src/routes/payment.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// Ensure new columns exist on live DB (idempotent)
const ensurePaymentCols = async () => {
  const alters = [
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS cost_head VARCHAR(100)`,
  ];
  for (const sql of alters) await query(sql).catch(() => {});
};
ensurePaymentCols();

router.get('/', async (req, res) => {
  const { project_id, payment_type, from_date, to_date } = req.query;
  let sql = `SELECT pay.*,p.name as project_name FROM payments pay
             JOIN projects p ON pay.project_id=p.id WHERE p.company_id=$1`;
  const params = [req.user.company_id]; let i=2;
  if (project_id) { sql+=` AND pay.project_id=$${i++}`; params.push(project_id); }
  if (payment_type) { sql+=` AND pay.payment_type=$${i++}`; params.push(payment_type); }
  if (from_date) { sql+=` AND pay.payment_date>=$${i++}`; params.push(from_date); }
  if (to_date) { sql+=` AND pay.payment_date<=$${i++}`; params.push(to_date); }
  sql+=' ORDER BY pay.payment_date DESC';
  const r = await query(sql, params);
  res.json({ data: r.rows, count: r.rowCount });
});

router.post('/', authorize('super_admin','admin','accountant'), async (req, res) => {
  const { project_id, payment_type, entity_name, entity_pan, invoice_id,
          amount, tds_deducted, payment_date, payment_mode, reference_number,
          bank_name, remarks, cost_head } = req.body;
  const projectCheck = await query(
    `SELECT 1 FROM projects WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [project_id, req.user.company_id]
  );
  if (!projectCheck.rowCount) {
    return res.status(400).json({ error: 'Invalid project for this company' });
  }
  const net = parseFloat(amount) - parseFloat(tds_deducted || 0);
  const r = await query(
    `INSERT INTO payments (project_id,payment_type,entity_name,entity_pan,invoice_id,amount,tds_deducted,net_amount,payment_date,payment_mode,reference_number,bank_name,remarks,created_by,cost_head)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [project_id,payment_type,entity_name,entity_pan,invoice_id,amount,tds_deducted||0,net,payment_date,payment_mode,reference_number,bank_name,remarks,req.user.id,cost_head||null]
  );
  res.status(201).json({ data: r.rows[0] });
});

// TDS Report — Form 26Q style
router.get('/tds-report', async (req, res) => {
  const { year, quarter } = req.query;
  const r = await query(
    `SELECT entity_name, entity_pan,
       SUM(amount) as gross_amount,
       SUM(tds_deducted) as tds_deducted,
       SUM(net_amount) as net_paid,
       COUNT(*) as transaction_count,
       payment_mode,
       MIN(payment_date) as first_payment,
       MAX(payment_date) as last_payment
     FROM payments pay JOIN projects p ON pay.project_id=p.id
     WHERE p.company_id=$1 AND pay.tds_deducted > 0
       AND EXTRACT(YEAR FROM pay.payment_date) = $2
     GROUP BY entity_name, entity_pan, payment_mode
     ORDER BY tds_deducted DESC`,
    [req.user.company_id, year || new Date().getFullYear()]
  );
  const totals = await query(
    `SELECT SUM(tds_deducted) as total_tds, SUM(amount) as total_gross
     FROM payments pay JOIN projects p ON pay.project_id=p.id
     WHERE p.company_id=$1 AND EXTRACT(YEAR FROM pay.payment_date) = $2`,
    [req.user.company_id, year || new Date().getFullYear()]
  );
  res.json({ data: r.rows, totals: totals.rows[0] });
});

module.exports = router;
