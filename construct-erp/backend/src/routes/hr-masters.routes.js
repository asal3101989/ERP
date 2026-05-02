// src/routes/hr-masters.routes.js
// Departments, Designations, Leave Types, Holiday Calendar — simple CRUD
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// ─── Auto-create tables ───────────────────────────────────────────────────────
const initTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      name TEXT NOT NULL,
      head_user_id UUID REFERENCES users(id),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS hr_designations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      name TEXT NOT NULL,
      department_id UUID REFERENCES hr_departments(id),
      grade TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS hr_holidays (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      holiday_date DATE NOT NULL,
      name TEXT NOT NULL,
      holiday_type TEXT DEFAULT 'national',
      year INT,
      UNIQUE(company_id, holiday_date)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS hr_leave_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      days_per_year NUMERIC(5,1) DEFAULT 0,
      carry_forward BOOLEAN DEFAULT FALSE,
      max_carry_forward NUMERIC(5,1) DEFAULT 0,
      is_paid BOOLEAN DEFAULT TRUE,
      applicable_gender TEXT DEFAULT 'all',
      is_active BOOLEAN DEFAULT TRUE
    )
  `);
};
initTables().catch(console.error);

// ═══════════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════════
router.get('/departments', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT d.*, u.name as head_name
       FROM hr_departments d
       LEFT JOIN users u ON u.id = d.head_user_id
       WHERE d.company_id = $1 AND d.is_active = TRUE
       ORDER BY d.name`,
      [req.user.company_id]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/departments', async (req, res) => {
  try {
    const { name, head_user_id } = req.body;
    const { rows } = await query(
      `INSERT INTO hr_departments (company_id, name, head_user_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.user.company_id, name, head_user_id || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/departments/:id', async (req, res) => {
  try {
    const { name, head_user_id, is_active } = req.body;
    const { rows } = await query(
      `UPDATE hr_departments SET name=$1, head_user_id=$2, is_active=$3
       WHERE id=$4 AND company_id=$5 RETURNING *`,
      [name, head_user_id || null, is_active ?? true, req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    await query(`UPDATE hr_departments SET is_active=FALSE WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// DESIGNATIONS
// ═══════════════════════════════════════════════════════════
router.get('/designations', async (req, res) => {
  try {
    const { department_id } = req.query;
    let sql = `SELECT d.*, dep.name as department_name
               FROM hr_designations d
               LEFT JOIN hr_departments dep ON dep.id = d.department_id
               WHERE d.company_id = $1 AND d.is_active = TRUE`;
    const params = [req.user.company_id];
    if (department_id) { sql += ` AND d.department_id = $2`; params.push(department_id); }
    sql += ' ORDER BY dep.name, d.name';
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/designations', async (req, res) => {
  try {
    const { name, department_id, grade } = req.body;
    const { rows } = await query(
      `INSERT INTO hr_designations (company_id, name, department_id, grade)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.company_id, name, department_id || null, grade || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/designations/:id', async (req, res) => {
  try {
    const { name, department_id, grade, is_active } = req.body;
    const { rows } = await query(
      `UPDATE hr_designations SET name=$1, department_id=$2, grade=$3, is_active=$4
       WHERE id=$5 AND company_id=$6 RETURNING *`,
      [name, department_id || null, grade || null, is_active ?? true, req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/designations/:id', async (req, res) => {
  try {
    await query(`UPDATE hr_designations SET is_active=FALSE WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// LEAVE TYPES
// ═══════════════════════════════════════════════════════════
router.get('/leave-types', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM hr_leave_types WHERE company_id=$1 AND is_active=TRUE ORDER BY name`,
      [req.user.company_id]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/leave-types', async (req, res) => {
  try {
    const { name, code, days_per_year, carry_forward, max_carry_forward, is_paid, applicable_gender } = req.body;
    const { rows } = await query(
      `INSERT INTO hr_leave_types (company_id, name, code, days_per_year, carry_forward, max_carry_forward, is_paid, applicable_gender)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.company_id, name, code, days_per_year || 0, carry_forward || false,
       max_carry_forward || 0, is_paid ?? true, applicable_gender || 'all']
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/leave-types/:id', async (req, res) => {
  try {
    const { name, code, days_per_year, carry_forward, max_carry_forward, is_paid, applicable_gender, is_active } = req.body;
    const { rows } = await query(
      `UPDATE hr_leave_types SET name=$1,code=$2,days_per_year=$3,carry_forward=$4,
       max_carry_forward=$5,is_paid=$6,applicable_gender=$7,is_active=$8
       WHERE id=$9 AND company_id=$10 RETURNING *`,
      [name, code, days_per_year, carry_forward, max_carry_forward, is_paid, applicable_gender,
       is_active ?? true, req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/leave-types/:id', async (req, res) => {
  try {
    await query(`UPDATE hr_leave_types SET is_active=FALSE WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// HOLIDAYS
// ═══════════════════════════════════════════════════════════
router.get('/holidays', async (req, res) => {
  try {
    const { year } = req.query;
    const yr = parseInt(year) || new Date().getFullYear();
    const { rows } = await query(
      `SELECT * FROM hr_holidays WHERE company_id=$1 AND year=$2 ORDER BY holiday_date`,
      [req.user.company_id, yr]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/holidays', async (req, res) => {
  try {
    const { holiday_date, name, holiday_type } = req.body;
    const year = new Date(holiday_date).getFullYear();
    const { rows } = await query(
      `INSERT INTO hr_holidays (company_id, holiday_date, name, holiday_type, year)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (company_id, holiday_date)
       DO UPDATE SET name=EXCLUDED.name, holiday_type=EXCLUDED.holiday_type RETURNING *`,
      [req.user.company_id, holiday_date, name, holiday_type || 'national', year]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/holidays/:id', async (req, res) => {
  try {
    const { holiday_date, name, holiday_type } = req.body;
    const year = new Date(holiday_date).getFullYear();
    const { rows } = await query(
      `UPDATE hr_holidays SET holiday_date=$1, name=$2, holiday_type=$3, year=$4
       WHERE id=$5 AND company_id=$6 RETURNING *`,
      [holiday_date, name, holiday_type, year, req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/holidays/:id', async (req, res) => {
  try {
    await query(`DELETE FROM hr_holidays WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
