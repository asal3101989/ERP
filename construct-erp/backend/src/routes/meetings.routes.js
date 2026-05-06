// backend/src/routes/meetings.routes.js
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { pool: db } = require('../config/database');

// GET /api/v1/meetings
router.get('/', authenticate, async (req, res) => {
  try {
    const { project_id, status, search } = req.query;
    let q = `SELECT m.*, p.name AS project_name
             FROM meetings m
             LEFT JOIN projects p ON p.id = m.project_id
             WHERE 1=1`;
    const params = [];
    if (project_id) { q += ` AND m.project_id = $${params.length+1}`; params.push(project_id); }
    if (status)      { q += ` AND m.status = $${params.length+1}`; params.push(status); }
    if (search)      { q += ` AND (m.meeting_number ILIKE $${params.length+1} OR m.title ILIKE $${params.length+1})`; params.push(`%${search}%`); }
    q += ' ORDER BY m.meeting_date DESC, m.created_at DESC';
    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('meetings list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch meetings' });
  }
});

// POST /api/v1/meetings
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      meeting_number, meeting_type, title, meeting_date, meeting_time,
      project_id, venue, minutes, attendees, action_items
    } = req.body;
    
    // Auto-generate meeting number if not provided
    let finalMeetingNumber = meeting_number;
    if (!finalMeetingNumber) {
        const numRes = await db.query(`SELECT COUNT(*) + 1 as next_id FROM meetings`);
        finalMeetingNumber = `MTG-${numRes.rows[0].next_id.toString().padStart(4, '0')}`;
    }

    const { rows } = await db.query(
      `INSERT INTO meetings
        (meeting_number, meeting_type, title, meeting_date, meeting_time,
         project_id, venue, minutes, attendees, action_items, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Scheduled')
       RETURNING *`,
      [finalMeetingNumber, meeting_type, title, meeting_date, meeting_time || null,
       project_id || null, venue, minutes, JSON.stringify(attendees || []), JSON.stringify(action_items || []), req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('meeting create error:', err);
    res.status(500).json({ success: false, message: 'Failed to log meeting' });
  }
});

// PATCH /api/v1/meetings/:id/close
router.patch('/:id/close', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `UPDATE meetings SET status='Completed', updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to close meeting' });
  }
});

module.exports = router;
