// src/routes/booking.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { project_id, status } = req.query;
    let sql = `SELECT b.*, p.name AS project_name,
               COALESCE((SELECT SUM(amount) FROM payment_schedules WHERE booking_id = b.id AND status = 'paid'), 0) AS collected_amount
               FROM unit_bookings b
               JOIN projects p ON b.project_id = p.id
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let i = 2;
    if (project_id) { sql += ` AND b.project_id = $${i++}`; params.push(project_id); }
    if (status)     { sql += ` AND b.status = $${i++}`;     params.push(status); }
    sql += ' ORDER BY b.booking_date DESC';
    res.json({ data: (await query(sql, params)).rows });
  } catch (err) {
    console.error('booking GET /:', err.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      project_id, unit_number, flat_type, area_sqft, floor_number,
      client_name, client_phone, client_email, client_pan,
      agreement_value, booking_date,
    } = req.body;
    if (!project_id || !client_name || !agreement_value) {
      return res.status(400).json({ error: 'project_id, client_name and agreement_value are required' });
    }
    const r = await query(
      `INSERT INTO unit_bookings
         (project_id, unit_number, flat_type, area_sqft, floor_number,
          client_name, client_phone, client_email, client_pan,
          agreement_value, booking_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'booked') RETURNING *`,
      [project_id, unit_number, flat_type, area_sqft, floor_number,
       client_name, client_phone, client_email, client_pan,
       agreement_value, booking_date]
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (err) {
    console.error('booking POST /:', err.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.post('/payment-schedule', async (req, res) => {
  try {
    const { booking_id, schedules } = req.body;
    if (!booking_id || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'booking_id and schedules array are required' });
    }
    // Verify booking belongs to user's company
    const booking = await query(
      `SELECT b.id FROM unit_bookings b
       JOIN projects p ON b.project_id = p.id
       WHERE b.id = $1 AND p.company_id = $2`,
      [booking_id, req.user.company_id]
    );
    if (!booking.rows[0]) return res.status(403).json({ error: 'Booking not found or unauthorized' });

    const inserted = [];
    for (const s of schedules) {
      const gst = (s.amount * (s.gst_rate || 5)) / 100;
      const r = await query(
        `INSERT INTO payment_schedules (booking_id, milestone, due_date, amount, gst_amount, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [booking_id, s.milestone, s.due_date, s.amount, gst, s.amount + gst]
      );
      inserted.push(r.rows[0]);
    }
    res.status(201).json({ data: inserted });
  } catch (err) {
    console.error('booking POST /payment-schedule:', err.message);
    res.status(500).json({ error: 'Failed to create payment schedule' });
  }
});

module.exports = router;
