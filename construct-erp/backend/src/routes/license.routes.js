// src/routes/license.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');
router.use(authenticate);

// Software Licenses
router.get('/', async (req, res) => {
  const r = await query(
    `SELECT * FROM software_licenses WHERE company_id=$1 ORDER BY software_name`,
    [req.user.company_id]
  );
  res.json({ data: r.rows });
});

router.post('/', authorize('super_admin','admin'), async (req, res) => {
  const { software_name, vendor, license_type, license_key, quantity,
          purchase_cost, purchase_date, expiry_date, auto_renew, notes } = req.body;
  const r = await query(
    `INSERT INTO software_licenses (company_id,software_name,vendor,license_type,license_key,quantity,purchase_cost,purchase_date,expiry_date,auto_renew,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.user.company_id,software_name,vendor,license_type,license_key,quantity||1,purchase_cost,purchase_date,expiry_date||null,auto_renew||false,notes]
  );
  res.status(201).json({ data: r.rows[0] });
});

router.put('/:id', authorize('super_admin','admin'), async (req, res) => {
  const { software_name, vendor, license_type, expiry_date, auto_renew, notes } = req.body;
  const r = await query(
    `UPDATE software_licenses SET software_name=COALESCE($1,software_name), vendor=COALESCE($2,vendor),
     license_type=COALESCE($3,license_type), expiry_date=COALESCE($4,expiry_date),
     auto_renew=COALESCE($5,auto_renew), notes=COALESCE($6,notes)
     WHERE id=$7 AND company_id=$8 RETURNING *`,
    [software_name,vendor,license_type,expiry_date,auto_renew,notes,req.params.id,req.user.company_id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'License not found' });
  res.json({ data: r.rows[0] });
});

router.delete('/:id', authorize('super_admin','admin'), async (req, res) => {
  await query('DELETE FROM software_licenses WHERE id=$1 AND company_id=$2', [req.params.id, req.user.company_id]);
  res.json({ message: 'Deleted' });
});

// AMC Contracts
router.get('/amc', async (req, res) => {
  const r = await query(
    `SELECT a.*, v.name as vendor_name FROM amc_contracts a
     LEFT JOIN vendors v ON a.vendor_id=v.id
     WHERE a.company_id=$1 ORDER BY a.end_date`,
    [req.user.company_id]
  );
  res.json({ data: r.rows });
});

router.post('/amc', authorize('super_admin','admin'), async (req, res) => {
  const { equipment_description, vendor_id, amc_value, start_date, end_date,
          coverage, contact_person, contact_phone } = req.body;
  const r = await query(
    `INSERT INTO amc_contracts (company_id,equipment_description,vendor_id,amc_value,start_date,end_date,coverage,contact_person,contact_phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.company_id,equipment_description,vendor_id,amc_value,start_date,end_date,coverage,contact_person,contact_phone]
  );
  res.status(201).json({ data: r.rows[0] });
});

module.exports = router;
