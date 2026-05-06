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

// POST /it-assets/import — bulk import from CSV
router.post('/import', authorize('super_admin','admin','it_admin'), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'No rows provided' });

    let inserted = 0, skipped = 0;
    for (const row of rows) {
      if (!row.asset_tag || !row.asset_type || !row.brand || !row.model) { skipped++; continue; }
      try {
        await query(
          `INSERT INTO it_assets
             (company_id,asset_tag,asset_type,brand,model,serial_number,
              purchase_date,purchase_cost,warranty_expiry,status,
              location_description,os,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (company_id, asset_tag) DO NOTHING`,
          [
            req.user.company_id,
            String(row.asset_tag).trim(),
            String(row.asset_type).trim().toLowerCase(),
            String(row.brand).trim(),
            String(row.model).trim(),
            row.serial_number || null,
            row.purchase_date || null,
            row.purchase_cost ? parseFloat(row.purchase_cost) : null,
            row.warranty_expiry || null,
            row.status || 'available',
            row.location_description || null,
            row.os || null,
            row.notes || null,
          ]
        );
        inserted++;
      } catch (_) { skipped++; }
    }
    res.json({ message: `Imported ${inserted} assets, ${skipped} skipped` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
