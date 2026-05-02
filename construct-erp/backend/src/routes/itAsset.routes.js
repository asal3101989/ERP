// src/routes/itAsset.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
router.use(authenticate);
router.get('/', async (req, res) => {
  const { asset_type, status } = req.query;
  let sql = `SELECT a.*,u.name as assigned_to_name,p.name as project_name FROM it_assets a
             LEFT JOIN users u ON a.assigned_to=u.id LEFT JOIN projects p ON a.location_project_id=p.id
             WHERE a.company_id=$1`;
  const params=[req.user.company_id]; let i=2;
  if (asset_type) { sql+=` AND a.asset_type=$${i++}`; params.push(asset_type); }
  if (status)     { sql+=` AND a.status=$${i++}`; params.push(status); }
  sql+=' ORDER BY a.asset_tag';
  res.json({ data: (await query(sql,params)).rows });
});
router.post('/', authorize('super_admin','admin','it_admin'), async (req, res) => {
  const { asset_tag,asset_type,brand,model,serial_number,purchase_date,purchase_cost,warranty_expiry,assigned_to,location_project_id,location_description,os,notes } = req.body;
  const r = await query(
    `INSERT INTO it_assets (company_id,asset_tag,asset_type,brand,model,serial_number,purchase_date,purchase_cost,warranty_expiry,assigned_to,location_project_id,location_description,os,notes,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'in_use') RETURNING *`,
    [req.user.company_id,asset_tag,asset_type,brand,model,serial_number,purchase_date,purchase_cost,warranty_expiry,assigned_to,location_project_id,location_description,os,notes]
  );
  res.status(201).json({ data: r.rows[0] });
});
router.put('/:id', async (req, res) => {
  const { status, assigned_to, notes } = req.body;
  const r = await query('UPDATE it_assets SET status=$1,assigned_to=$2,notes=$3 WHERE id=$4 RETURNING *',[status,assigned_to,notes,req.params.id]);
  res.json({ data: r.rows[0] });
});
module.exports = router;
