// src/routes/asset.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
router.use(authenticate);

// GET /assets — Get all assets with telemetry
router.get('/', async (req, res) => {
  try {
    const { asset_type, status, project_id } = req.query;
    let sql = `
      SELECT a.*, p.name as current_project_name, u.name as assigned_to_name, v.name as vendor_name,
             (SELECT SUM(quantity) FROM asset_fuel_logs WHERE asset_id = a.id) as total_fuel_consumed,
             (SELECT SUM(units_worked) FROM asset_usage_logs WHERE asset_id = a.id) as total_units_worked
      FROM assets a 
      LEFT JOIN projects p ON a.current_location=p.id
      LEFT JOIN users u ON a.assigned_to=u.id 
      LEFT JOIN vendors v ON a.vendor_id=v.id
      WHERE a.company_id=$1`;
    const params=[req.user.company_id]; let i=2;
    if (asset_type) { sql+=` AND a.asset_type=$${i++}`; params.push(asset_type); }
    if (status)     { sql+=` AND a.status=$${i++}`; params.push(status); }
    if (project_id) { sql+=` AND a.current_location=$${i++}`; params.push(project_id); }
    sql+=' ORDER BY a.asset_code';
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /assets — Register new asset
router.post('/', authorize('super_admin','admin'), async (req, res) => {
  try {
    const { asset_code, asset_name, asset_type, brand, model, serial_number, purchase_date,
            purchase_value, vendor_id, warranty_expiry, amc_expiry, current_location, 
            meter_type, fuel_type, current_meter, hourly_rate, notes } = req.body;
    
    const qrCode = `QR-${asset_code}-${Date.now()}`;
    const r = await query(
      `INSERT INTO assets 
         (company_id, asset_code, asset_name, asset_type, brand, model, serial_number, 
          purchase_date, purchase_value, vendor_id, warranty_expiry, amc_expiry, 
          current_location, qr_code, notes, status, meter_type, fuel_type, 
          current_meter, hourly_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'available',$16,$17,$18,$19) 
       RETURNING *`,
      [req.user.company_id, asset_code, asset_name, asset_type, brand, model, serial_number, 
       purchase_date, purchase_value, vendor_id, warranty_expiry, amc_expiry, current_location, 
       qrCode, notes, meter_type || 'Hours', fuel_type || 'Diesel', current_meter || 0, hourly_rate || 0]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /assets/logs/fuel — Log fuel consumption
router.post('/logs/fuel', async (req, res) => {
  try {
    const { asset_id, project_id, quantity, rate_per_liter, meter_reading, remarks } = req.body;
    const result = await withTransaction(async (client) => {
      const log = await client.query(
        `INSERT INTO asset_fuel_logs 
           (company_id, asset_id, project_id, quantity, rate_per_liter, total_cost, meter_at_log, issued_by, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.user.company_id, asset_id, project_id, quantity, rate_per_liter, 
         quantity * (rate_per_liter || 0), meter_reading, req.user.id, remarks]
      );
      return log.rows[0];
    });
    res.status(201).json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /assets/logs/usage — Log daily usage
router.post('/logs/usage', async (req, res) => {
  try {
    const { asset_id, project_id, start_meter, end_meter, operator_name, activity_name, remarks } = req.body;
    const units_worked = parseFloat(end_meter) - parseFloat(start_meter);
    if (units_worked < 0) return res.status(400).json({ error: 'End meter cannot be less than start meter' });

    const result = await withTransaction(async (client) => {
      // 1. Create Log
      const log = await client.query(
        `INSERT INTO asset_usage_logs 
           (company_id, asset_id, project_id, start_meter, end_meter, units_worked, operator_name, activity_name, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [req.user.company_id, asset_id, project_id, start_meter, end_meter, units_worked, operator_name, activity_name, remarks]
      );

      // 2. Update Asset Master Meter
      await client.query(
        `UPDATE assets SET current_meter = $1, updated_at = NOW() WHERE id = $2`,
        [end_meter, asset_id]
      );

      return log.rows[0];
    });
    res.status(201).json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /assets/:id
router.put('/:id', authorize('super_admin','admin'), async (req, res) => {
  const { asset_name, status, current_location, warranty_expiry, amc_expiry, notes, next_service_date, next_service_meter } = req.body;
  const r = await query(
    `UPDATE assets SET asset_name=COALESCE($1,asset_name), status=COALESCE($2,status),
     current_location=COALESCE($3,current_location), warranty_expiry=COALESCE($4,warranty_expiry),
     amc_expiry=COALESCE($5,amc_expiry), notes=COALESCE($6,notes),
     next_service_date=COALESCE($7,next_service_date), next_service_meter=COALESCE($8,next_service_meter), 
     updated_at=NOW()
     WHERE id=$9 AND company_id=$10 RETURNING *`,
    [asset_name,status,current_location,warranty_expiry,amc_expiry,notes,next_service_date,next_service_meter,req.params.id,req.user.company_id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Asset not found' });
  res.json({ data: r.rows[0] });
});

module.exports = router;
