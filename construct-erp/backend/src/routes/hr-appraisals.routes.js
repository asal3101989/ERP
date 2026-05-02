// src/routes/hr-appraisals.routes.js
// Annual performance reviews, KRA scoring, increment management
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

const initTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_appraisals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      user_id UUID REFERENCES users(id),
      review_period TEXT,
      review_date DATE,
      reviewer_id UUID REFERENCES users(id),
      kra_score NUMERIC(5,2),
      overall_rating TEXT,
      increment_pct NUMERIC(5,2) DEFAULT 0,
      increment_amount NUMERIC(12,2) DEFAULT 0,
      new_ctc NUMERIC(14,2),
      comments TEXT,
      status TEXT DEFAULT 'draft',
      acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
initTable().catch(console.error);

router.get('/', async (req, res) => {
  try {
    const { user_id, review_period, status } = req.query;
    let sql = `
      SELECT a.*, u.name as employee_name, u.employee_code,
             r.name as reviewer_name, dep.name as department_name
      FROM hr_appraisals a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN users r ON r.id = a.reviewer_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN hr_departments dep ON dep.id = ep.department_id
      WHERE a.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;
    if (user_id)       { sql += ` AND a.user_id=$${idx}`;       params.push(user_id);       idx++; }
    if (review_period) { sql += ` AND a.review_period=$${idx}`;  params.push(review_period); idx++; }
    if (status)        { sql += ` AND a.status=$${idx}`;         params.push(status);        idx++; }
    sql += ' ORDER BY a.created_at DESC';
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.*, u.name as employee_name, u.employee_code, r.name as reviewer_name
       FROM hr_appraisals a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN users r ON r.id = a.reviewer_id
       WHERE a.id=$1 AND a.company_id=$2`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const {
      user_id, review_period, review_date, reviewer_id,
      kra_score, overall_rating, increment_pct, increment_amount, new_ctc, comments
    } = req.body;
    const { rows } = await query(
      `INSERT INTO hr_appraisals
       (company_id, user_id, review_period, review_date, reviewer_id,
        kra_score, overall_rating, increment_pct, increment_amount, new_ctc, comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.company_id, user_id, review_period || null, review_date || null,
       reviewer_id || req.user.id, kra_score || null, overall_rating || null,
       increment_pct || 0, increment_amount || 0, new_ctc || null, comments || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      review_date, kra_score, overall_rating, increment_pct, increment_amount, new_ctc, comments, status
    } = req.body;
    const { rows } = await query(
      `UPDATE hr_appraisals SET review_date=$1, kra_score=$2, overall_rating=$3,
         increment_pct=$4, increment_amount=$5, new_ctc=$6, comments=$7, status=$8
       WHERE id=$9 AND company_id=$10 RETURNING *`,
      [review_date || null, kra_score || null, overall_rating || null,
       increment_pct || 0, increment_amount || 0, new_ctc || null, comments || null,
       status || 'draft', req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/acknowledge', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE hr_appraisals SET status='acknowledged', acknowledged_at=NOW()
       WHERE id=$1 AND company_id=$2 AND user_id=$3 RETURNING *`,
      [req.params.id, req.user.company_id, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'Cannot acknowledge this appraisal' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
