// src/routes/incident.routes.js
const express = require('express');
const router = express.Router();
const { createIncident, getIncidents, addCAPA, getSafetyDashboard } = require('../controllers/incident.controller');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);
router.get('/safety-dashboard', getSafetyDashboard);
router.get('/', getIncidents);
router.post('/', createIncident);
router.get('/:id', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const [inc, capa] = await Promise.all([
      query(
        `SELECT i.*, p.name AS project_name, u.name AS reported_by_name
         FROM incidents i
         JOIN projects p ON i.project_id = p.id
         LEFT JOIN users u ON i.reported_by = u.id
         WHERE i.id = $1 AND p.company_id = $2`,
        [req.params.id, req.user.company_id]
      ),
      query(
        `SELECT ca.*, u.name AS assigned_to_name
         FROM corrective_actions ca
         LEFT JOIN users u ON ca.assigned_to = u.id
         WHERE ca.incident_id = $1`,
        [req.params.id]
      ),
    ]);
    if (!inc.rows[0]) return res.status(404).json({ error: 'Incident not found' });
    res.json({ ...inc.rows[0], corrective_actions: capa.rows });
  } catch (err) {
    console.error('incident GET /:id:', err.message);
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});
router.post('/:id/capa', addCAPA);
router.patch('/:id/close', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const result = await query(
      `UPDATE incidents SET status=$1, closed_at=NOW() WHERE id=$2
       AND project_id IN (SELECT id FROM projects WHERE company_id=$3) RETURNING id`,
      ['closed', req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Incident not found' });
    res.json({ message: 'Incident closed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
