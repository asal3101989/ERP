// src/routes/worker.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/', async (req, res) => {
  const { project_id, skill_type, contractor_id, is_active } = req.query;
  let sql = `SELECT w.*,v.name as contractor_name FROM workers w
             LEFT JOIN vendors v ON w.contractor_id=v.id
             WHERE 1=1`;
  const params = []; let i=1;
  if (project_id)    { sql+=` AND w.project_id=$${i++}`; params.push(project_id); }
  if (skill_type)    { sql+=` AND w.skill_type=$${i++}`; params.push(skill_type); }
  if (contractor_id) { sql+=` AND w.contractor_id=$${i++}`; params.push(contractor_id); }
  if (is_active !== undefined) { sql+=` AND w.is_active=$${i++}`; params.push(is_active === 'true'); }
  sql+=' ORDER BY w.name';
  const r = await query(sql, params);
  res.json({ data: r.rows, count: r.rowCount });
});

router.post('/', async (req, res) => {
  const { project_id, name, skill_type, gang_name, contractor_id, bocw_number,
          aadhaar_last4, pan, daily_rate, ot_rate, state_of_origin, joined_date } = req.body;
  const code = `WRK-${Date.now().toString().slice(-6)}`;
  const r = await query(
    `INSERT INTO workers (project_id,worker_code,name,skill_type,gang_name,contractor_id,bocw_number,aadhaar_last4,pan,daily_rate,ot_rate,state_of_origin,is_active,joined_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13) RETURNING *`,
    [project_id,code,name,skill_type,gang_name,contractor_id,bocw_number,aadhaar_last4,pan,daily_rate,ot_rate||daily_rate*2,state_of_origin,joined_date||new Date()]
  );
  res.status(201).json({ data: r.rows[0] });
});

router.get('/:id', async (req, res) => {
  const r = await query('SELECT w.*,v.name as contractor_name FROM workers w LEFT JOIN vendors v ON w.contractor_id=v.id WHERE w.id=$1',[req.params.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Worker not found' });
  res.json(r.rows[0]);
});

router.put('/:id', async (req, res) => {
  const { daily_rate, skill_type, gang_name, is_active } = req.body;
  const r = await query(
    'UPDATE workers SET daily_rate=$1,skill_type=$2,gang_name=$3,is_active=$4 WHERE id=$5 RETURNING *',
    [daily_rate,skill_type,gang_name,is_active,req.params.id]
  );
  res.json({ data: r.rows[0] });
});

module.exports = router;
