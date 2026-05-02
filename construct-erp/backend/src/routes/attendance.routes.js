// src/routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id, date, worker_id } = req.query;
    let sql = `SELECT a.*, w.name AS worker_name, w.skill_type, w.daily_rate, w.gang_name
               FROM attendance a
               JOIN workers w ON a.worker_id = w.id
               WHERE 1=1`;
    const params = []; let i = 1;
    if (project_id) { sql += ` AND a.project_id = $${i++}`;      params.push(project_id); }
    if (date)       { sql += ` AND a.attendance_date = $${i++}`;  params.push(date); }
    if (worker_id)  { sql += ` AND a.worker_id = $${i++}`;        params.push(worker_id); }
    sql += ' ORDER BY a.attendance_date DESC, w.name';
    res.json({ data: (await query(sql, params)).rows });
  } catch (err) {
    console.error('attendance GET /:', err.message);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Bulk mark attendance for a date
router.post('/bulk', async (req, res) => {
  try {
    const { project_id, date, records } = req.body;
    if (!project_id || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'project_id, date and records array are required' });
    }
    const result = await withTransaction(async (client) => {
      const inserted = [];
      for (const rec of records) {
        const r = await client.query(
          `INSERT INTO attendance (project_id, worker_id, attendance_date, status, ot_hours, recorded_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (worker_id, attendance_date)
           DO UPDATE SET status = EXCLUDED.status, ot_hours = EXCLUDED.ot_hours
           RETURNING *`,
          [project_id, rec.worker_id, date, rec.status, rec.ot_hours || 0, req.user.id]
        );
        inserted.push(r.rows[0]);
      }
      return inserted;
    });
    res.json({ message: `Attendance marked for ${result.length} workers`, data: result });
  } catch (err) {
    console.error('attendance POST /bulk:', err.message);
    res.status(500).json({ error: 'Failed to record bulk attendance' });
  }
});

// Summary: attendance count for a period
router.get('/summary', async (req, res) => {
  try {
    const { project_id, from_date, to_date } = req.query;
    if (!project_id || !from_date || !to_date) {
      return res.status(400).json({ error: 'project_id, from_date and to_date are required' });
    }
    const r = await query(
      `SELECT w.id, w.name, w.skill_type, w.daily_rate, w.gang_name,
         COUNT(*) FILTER (WHERE a.status = 'present')  AS days_present,
         COUNT(*) FILTER (WHERE a.status = 'absent')   AS days_absent,
         COUNT(*) FILTER (WHERE a.status = 'half_day') AS half_days,
         COALESCE(SUM(a.ot_hours), 0)                  AS total_ot_hours
       FROM workers w
       LEFT JOIN attendance a ON a.worker_id = w.id
         AND a.attendance_date BETWEEN $2 AND $3
       WHERE w.project_id = $1 AND w.is_active = true
       GROUP BY w.id, w.name, w.skill_type, w.daily_rate, w.gang_name
       ORDER BY w.name`,
      [project_id, from_date, to_date]
    );
    res.json({ data: r.rows });
  } catch (err) {
    console.error('attendance GET /summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

module.exports = router;
