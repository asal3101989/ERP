// backend/src/routes/submittals.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool: db } = require('../config/database');

// GET /api/v1/quality/submittals
router.get('/', authenticate, async (req, res) => {
  try {
    const { project_id, status, search } = req.query;
    let q = `SELECT s.*, p.name AS project_name
             FROM submittals s
             LEFT JOIN projects p ON p.id = s.project_id
             WHERE 1=1`;
    const params = [];
    if (project_id) { q += ` AND s.project_id = $${params.length+1}`; params.push(project_id); }
    if (status)      { q += ` AND s.status = $${params.length+1}`; params.push(status); }
    if (search)      { q += ` AND (s.submittal_number ILIKE $${params.length+1} OR s.title ILIKE $${params.length+1})`; params.push(`%${search}%`); }
    q += ' ORDER BY s.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('submittals list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch submittals' });
  }
});

// POST /api/v1/quality/submittals
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      submittal_number, submittal_type, title, spec_section,
      project_id, submitted_by, submitted_date, due_date, status, remarks
    } = req.body;
    const { rows } = await db.query(
      `INSERT INTO submittals
        (submittal_number, submittal_type, title, spec_section, project_id,
         submitted_by, submitted_date, due_date, status, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [submittal_number, submittal_type, title, spec_section,
       project_id || null, submitted_by, submitted_date, due_date || null,
       status || 'Submitted', remarks, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('submittal create error:', err);
    res.status(500).json({ success: false, message: 'Failed to create submittal' });
  }
});

// PATCH /api/v1/quality/submittals/:id/status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const { rows } = await db.query(
      `UPDATE submittals SET status=$1, remarks=COALESCE($2, remarks), updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [status, remarks, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submittal not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update submittal status' });
  }
});

module.exports = router;
