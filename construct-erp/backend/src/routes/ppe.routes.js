// src/routes/ppe.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
router.use(authenticate);
router.get('/', async (req, res) => {
  const { project_id, worker_id, item_type } = req.query;
  let sql = `SELECT pr.*,w.name as worker_name,w.bocw_number,w.skill_type,p.name as project_name
             FROM ppe_records pr JOIN workers w ON pr.worker_id=w.id
             JOIN projects p ON pr.project_id=p.id WHERE p.company_id=$1`;
  const params=[req.user.company_id]; let i=2;
  if (project_id) { sql+=` AND pr.project_id=$${i++}`; params.push(project_id); }
  if (worker_id)  { sql+=` AND pr.worker_id=$${i++}`; params.push(worker_id); }
  if (item_type)  { sql+=` AND pr.item_type=$${i++}`; params.push(item_type); }
  sql+=' ORDER BY pr.issued_date DESC';
  res.json({ data: (await query(sql,params)).rows });
});
router.post('/', async (req, res) => {
  const { project_id, worker_id, item_type, item_code, issued_date, expiry_date, condition } = req.body;
  // Verify project belongs to user's company
  const proj = await query('SELECT id FROM projects WHERE id=$1 AND company_id=$2',[project_id,req.user.company_id]);
  if (!proj.rows[0]) return res.status(403).json({ error: 'Project not found or unauthorized' });
  const r = await query(
    `INSERT INTO ppe_records (project_id,worker_id,item_type,item_code,issued_date,expiry_date,condition,issued_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [project_id,worker_id,item_type,item_code,issued_date,expiry_date,condition||'good',req.user.id]
  );
  res.status(201).json({ data: r.rows[0] });
});
router.patch('/:id/return', async (req, res) => {
  const r = await query(
    `UPDATE ppe_records SET returned=true,returned_date=NOW(),updated_at=NOW()
     WHERE id=$1 AND project_id IN (SELECT id FROM projects WHERE company_id=$2) RETURNING id`,
    [req.params.id, req.user.company_id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Record not found' });
  res.json({ message: 'PPE returned' });
});
router.get('/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const r = await query(
      `SELECT pr.*,w.name as worker_name,w.bocw_number,p.name as project_name
       FROM ppe_records pr JOIN workers w ON pr.worker_id=w.id
       JOIN projects p ON pr.project_id=p.id
       WHERE p.company_id=$1 AND pr.expiry_date BETWEEN NOW() AND NOW() + ($2 * INTERVAL '1 day')
       ORDER BY pr.expiry_date`,
      [req.user.company_id, days]
    );
    res.json({ data: r.rows, count: r.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
