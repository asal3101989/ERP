// src/routes/permit.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
router.use(authenticate);

router.get('/', async (req, res) => {
  const { project_id, permit_type, status } = req.query;
  let sql = `SELECT pe.*,p.name as project_name,u1.name as issued_by_name,u2.name as approved_by_name
             FROM permits pe JOIN projects p ON pe.project_id=p.id
             LEFT JOIN users u1 ON pe.issued_by=u1.id LEFT JOIN users u2 ON pe.approved_by=u2.id
             WHERE p.company_id=$1`;
  const params=[req.user.company_id]; let i=2;
  if (project_id)  { sql+=` AND pe.project_id=$${i++}`; params.push(project_id); }
  if (permit_type) { sql+=` AND pe.permit_type=$${i++}`; params.push(permit_type); }
  if (status)      { sql+=` AND pe.status=$${i++}`; params.push(status); }
  sql+=' ORDER BY pe.valid_from DESC';
  res.json({ data: (await query(sql,params)).rows });
});

router.post('/', authorize('super_admin','admin','hse_officer','project_manager'), async (req, res) => {
  const { project_id, permit_type, work_description, location, valid_from, valid_to, issued_to, preconditions } = req.body;
  const num = `PTW-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const r = await query(
    `INSERT INTO permits (project_id,permit_number,permit_type,work_description,location,valid_from,valid_to,issued_to,preconditions,issued_by,approved_by,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'active') RETURNING *`,
    [project_id,num,permit_type,work_description,location,valid_from,valid_to,issued_to,JSON.stringify(preconditions||[]),req.user.id]
  );
  res.status(201).json({ data: r.rows[0] });
});

router.patch('/:id/close', async (req, res) => {
  await query('UPDATE permits SET status=$1 WHERE id=$2',['closed',req.params.id]);
  res.json({ message: 'Permit closed' });
});

// Auto-expire check
router.get('/check-expiry', async (req, res) => {
  const r = await query(
    `UPDATE permits SET status='expired' WHERE status='active' AND valid_to < NOW() RETURNING id,permit_number,permit_type`
  );
  res.json({ expired: r.rows, count: r.rowCount });
});

module.exports = router;
