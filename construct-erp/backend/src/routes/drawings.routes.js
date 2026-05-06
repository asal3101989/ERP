// backend/src/routes/drawings.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool: db } = require('../config/database');

// GET /api/v1/quality/drawings
router.get('/', authenticate, async (req, res) => {
  try {
    const { project_id, discipline, status, search } = req.query;
    let q = `SELECT d.*, p.name AS project_name
             FROM drawings d
             LEFT JOIN projects p ON p.id = d.project_id
             WHERE 1=1`;
    const params = [];
    if (project_id) { q += ` AND d.project_id = $${params.length+1}`; params.push(project_id); }
    if (discipline)  { q += ` AND d.discipline = $${params.length+1}`; params.push(discipline); }
    if (status)      { q += ` AND d.status = $${params.length+1}`; params.push(status); }
    if (search)      { q += ` AND (d.drawing_number ILIKE $${params.length+1} OR d.title ILIKE $${params.length+1})`; params.push(`%${search}%`); }
    q += ' ORDER BY d.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('drawings list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch drawings' });
  }
});

// POST /api/v1/quality/drawings
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      drawing_number, title, discipline, revision, status,
      project_id, issued_date, scale, sheet_size,
      drawn_by, remarks, file_url
    } = req.body;
    const { rows } = await db.query(
      `INSERT INTO drawings
        (drawing_number, title, discipline, revision, status, project_id,
         issued_date, scale, sheet_size, drawn_by, remarks, file_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [drawing_number, title, discipline, revision || '0', status,
       project_id || null, issued_date || null, scale, sheet_size,
       drawn_by, remarks, file_url, req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('drawing create error:', err);
    res.status(500).json({ success: false, message: 'Failed to register drawing' });
  }
});

// PUT /api/v1/quality/drawings/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { drawing_number, title, discipline, revision, status, issued_date, scale, sheet_size, drawn_by, remarks, file_url } = req.body;
    const { rows } = await db.query(
      `UPDATE drawings SET drawing_number=$1, title=$2, discipline=$3, revision=$4,
       status=$5, issued_date=$6, scale=$7, sheet_size=$8, drawn_by=$9,
       remarks=$10, file_url=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [drawing_number, title, discipline, revision, status, issued_date, scale, sheet_size, drawn_by, remarks, file_url, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Drawing not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update drawing' });
  }
});

// DELETE /api/v1/quality/drawings/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM drawings WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Drawing deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete drawing' });
  }
});

module.exports = router;
