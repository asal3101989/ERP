// src/routes/hr-attendance.routes.js
// Salaried employee attendance (separate from site workers)
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// ─── Auto-create table ────────────────────────────────────────────────────────
const initTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      company_id UUID REFERENCES companies(id),
      attendance_date DATE NOT NULL,
      status TEXT DEFAULT 'present',
      in_time TIME,
      out_time TIME,
      late_minutes INT DEFAULT 0,
      early_exit_minutes INT DEFAULT 0,
      source TEXT DEFAULT 'manual',
      leave_request_id UUID,
      remarks TEXT,
      UNIQUE(user_id, attendance_date)
    )
  `);
};
initTable().catch(console.error);

// ═══════════════════════════════════════════════════════════
// GET — monthly grid (company-wide or per user)
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { user_id, month, year, department_id } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year)  || new Date().getFullYear();

    let sql = `
      SELECT a.*, u.name as employee_name, u.employee_code,
             ep.department_id, dep.name as department_name
      FROM hr_attendance a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN hr_departments dep ON dep.id = ep.department_id
      WHERE a.company_id = $1
        AND EXTRACT(MONTH FROM a.attendance_date) = $2
        AND EXTRACT(YEAR  FROM a.attendance_date) = $3`;
    const params = [req.user.company_id, m, y];
    let idx = 4;

    if (user_id)      { sql += ` AND a.user_id=$${idx}`;       params.push(user_id);      idx++; }
    if (department_id){ sql += ` AND ep.department_id=$${idx}`; params.push(department_id); idx++; }

    sql += ' ORDER BY u.name, a.attendance_date';
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// SUMMARY — per employee for a month
// ═══════════════════════════════════════════════════════════
router.get('/summary', async (req, res) => {
  try {
    const { month, year, department_id } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year)  || new Date().getFullYear();

    let sql = `
      SELECT u.id as user_id, u.name, u.employee_code,
             dep.name as department_name,
             COUNT(a.id) as total_marked,
             COUNT(a.id) FILTER (WHERE a.status='present')   as present,
             COUNT(a.id) FILTER (WHERE a.status='absent')    as absent,
             COUNT(a.id) FILTER (WHERE a.status='half_day')  as half_day,
             COUNT(a.id) FILTER (WHERE a.status='leave')     as on_leave,
             COUNT(a.id) FILTER (WHERE a.status='holiday')   as holidays,
             COUNT(a.id) FILTER (WHERE a.status='week_off')  as week_off,
             SUM(a.late_minutes) as total_late_minutes
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN hr_departments dep ON dep.id = ep.department_id
      LEFT JOIN hr_attendance a ON a.user_id = u.id
        AND EXTRACT(MONTH FROM a.attendance_date) = $2
        AND EXTRACT(YEAR  FROM a.attendance_date) = $3
      WHERE u.company_id = $1 AND u.is_active = TRUE`;
    const params = [req.user.company_id, m, y];
    let idx = 4;

    if (department_id) { sql += ` AND ep.department_id=$${idx}`; params.push(department_id); idx++; }

    sql += ' GROUP BY u.id, u.name, u.employee_code, dep.name ORDER BY u.name';
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// BULK MARK — mark attendance for a date (one or all employees)
// ═══════════════════════════════════════════════════════════
router.post('/bulk', async (req, res) => {
  try {
    const { attendance_date, records } = req.body;
    // records: [{ user_id, status, in_time, out_time, remarks }]
    const inserted = [];
    for (const rec of records) {
      const { rows } = await query(
        `INSERT INTO hr_attendance (user_id, company_id, attendance_date, status, in_time, out_time, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id, attendance_date)
         DO UPDATE SET status=$4, in_time=$5, out_time=$6, remarks=$7
         RETURNING *`,
        [rec.user_id, req.user.company_id, attendance_date,
         rec.status || 'present', rec.in_time || null, rec.out_time || null, rec.remarks || null]
      );
      inserted.push(rows[0]);
    }
    res.status(201).json({ data: inserted, count: inserted.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// UPDATE SINGLE RECORD
// ═══════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const { status, in_time, out_time, late_minutes, remarks } = req.body;
    const { rows } = await query(
      `UPDATE hr_attendance SET status=$1, in_time=$2, out_time=$3, late_minutes=$4, remarks=$5
       WHERE id=$6 AND company_id=$7 RETURNING *`,
      [status, in_time || null, out_time || null, late_minutes || 0, remarks || null,
       req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// UPSERT SINGLE (by user_id + date)
// ═══════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { user_id, attendance_date, status, in_time, out_time, late_minutes, remarks } = req.body;
    const { rows } = await query(
      `INSERT INTO hr_attendance (user_id, company_id, attendance_date, status, in_time, out_time, late_minutes, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, attendance_date)
       DO UPDATE SET status=$4, in_time=$5, out_time=$6, late_minutes=$7, remarks=$8
       RETURNING *`,
      [user_id, req.user.company_id, attendance_date, status || 'present',
       in_time || null, out_time || null, late_minutes || 0, remarks || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
