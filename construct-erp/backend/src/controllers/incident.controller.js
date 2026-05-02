// src/controllers/incident.controller.js
const { query, withTransaction } = require('../config/database');

// POST /api/v1/incidents
const createIncident = async (req, res) => {
  try {
    const {
      project_id, incident_date, incident_time, location,
      incident_type, severity, description,
      people_involved, root_cause, immediate_action,
      lost_time_days, site_photos
    } = req.body;

    // Auto-generate incident number (timestamp-based to avoid race conditions)
    const incidentNumber = `INC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const result = await query(
      `INSERT INTO incidents (
        project_id, incident_number, incident_date, incident_time,
        location, incident_type, severity, description,
        people_involved, root_cause, immediate_action,
        lost_time_days, site_photos, reported_by, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'open')
      RETURNING *`,
      [
        project_id, incidentNumber, incident_date, incident_time,
        location, incident_type, severity, description,
        JSON.stringify(people_involved || []), root_cause, immediate_action,
        lost_time_days || 0, site_photos || [], req.user.id
      ]
    );
    res.status(201).json({ message: 'Incident reported.', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/incidents
const getIncidents = async (req, res) => {
  try {
    const { project_id, status, incident_type, severity } = req.query;
    let sql = `SELECT i.*, p.name as project_name, u.name as reported_by_name
               FROM incidents i JOIN projects p ON i.project_id = p.id
               LEFT JOIN users u ON i.reported_by = u.id
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;

    if (project_id) { sql += ` AND i.project_id = $${idx++}`; params.push(project_id); }
    if (status) { sql += ` AND i.status = $${idx++}`; params.push(status); }
    if (incident_type) { sql += ` AND i.incident_type = $${idx++}`; params.push(incident_type); }
    if (severity) { sql += ` AND i.severity = $${idx++}`; params.push(severity); }

    sql += ' ORDER BY i.incident_date DESC, i.created_at DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/incidents/:id/capa
const addCAPA = async (req, res) => {
  try {
    const { action_description, assigned_to, due_date } = req.body;
    const result = await query(
      `INSERT INTO corrective_actions (incident_id, action_description, assigned_to, due_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, action_description, assigned_to, due_date]
    );
    res.status(201).json({ message: 'CAPA added.', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/incidents/safety-dashboard
const getSafetyDashboard = async (req, res) => {
  try {
    const { project_id, year } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const stats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE incident_type = 'near_miss') as near_miss,
        COUNT(*) FILTER (WHERE incident_type = 'minor_injury') as minor_injury,
        COUNT(*) FILTER (WHERE incident_type = 'major_accident') as major_accident,
        COUNT(*) FILTER (WHERE incident_type = 'fatality') as fatality,
        COUNT(*) FILTER (WHERE status = 'open') as open_incidents,
        SUM(lost_time_days) as total_lti_days
       FROM incidents i JOIN projects p ON i.project_id = p.id
       WHERE p.company_id = $1
         AND EXTRACT(YEAR FROM incident_date) = $2
         ${project_id ? 'AND i.project_id = $3' : ''}`,
      project_id ? [req.user.company_id, yearFilter, project_id] : [req.user.company_id, yearFilter]
    );

    const openCapa = await query(
      `SELECT COUNT(*) as open_capa FROM corrective_actions ca
       JOIN incidents i ON ca.incident_id = i.id
       JOIN projects p ON i.project_id = p.id
       WHERE p.company_id = $1 AND ca.status IN ('open','in_progress')`,
      [req.user.company_id]
    );

    const activePermits = await query(
      `SELECT permit_type, COUNT(*) as count FROM permits pe
       JOIN projects p ON pe.project_id = p.id
       WHERE p.company_id = $1 AND pe.status = 'active' AND pe.valid_to > NOW()
       GROUP BY permit_type`,
      [req.user.company_id]
    );

    res.json({
      incident_stats: stats.rows[0],
      open_capa: openCapa.rows[0].open_capa,
      active_permits: activePermits.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createIncident, getIncidents, addCAPA, getSafetyDashboard };
