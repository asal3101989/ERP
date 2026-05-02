// src/controllers/project.controller.js
const { query, withTransaction } = require('../config/database');

// GET /api/v1/projects
const getProjects = async (req, res) => {
  try {
    const { status, type, search } = req.query;
    let sql = `
      SELECT p.*,
        pm.name as pm_name, pm.phone as pm_phone,
        se.name as se_name,
        qe.name as qs_name,
        (SELECT COUNT(*) FROM boq_items WHERE project_id = p.id) as boq_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE project_id = p.id AND payment_status = 'paid') as amount_collected,
        (SELECT COALESCE(SUM(actual_amount), 0) FROM budget_items WHERE project_id = p.id) as total_spent
      FROM projects p
      LEFT JOIN users pm ON p.project_manager_id = pm.id
      LEFT JOIN users se ON p.site_engineer_id = se.id
      LEFT JOIN users qe ON p.qs_engineer_id = qe.id
      WHERE p.company_id = $1 AND p.is_active = true
    `;
    const params = [req.user.company_id];
    let i = 2;

    if (status) { sql += ` AND p.status = $${i++}`; params.push(status); }
    if (type) { sql += ` AND p.type = $${i++}`; params.push(type); }
    if (search) { sql += ` AND p.name ILIKE $${i++}`; params.push(`%${search}%`); }

    sql += ' ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/projects/:id
const getProject = async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*,
        pm.name as pm_name, pm.email as pm_email, pm.phone as pm_phone,
        se.name as se_name, se.email as se_email,
        qe.name as qs_name,
        (SELECT COALESCE(SUM(amount),0) FROM boq_items WHERE project_id = p.id) as total_boq_value,
        (SELECT COALESCE(SUM(net_payable),0) FROM ra_bills WHERE project_id = p.id AND status = 'certified') as total_certified,
        (SELECT COUNT(*) FROM workers WHERE project_id = p.id AND is_active = true) as worker_count,
        (SELECT COUNT(*) FROM incidents WHERE project_id = p.id AND status != 'closed') as open_incidents
       FROM projects p
       LEFT JOIN users pm ON p.project_manager_id = pm.id
       LEFT JOIN users se ON p.site_engineer_id = se.id
       LEFT JOIN users qe ON p.qs_engineer_id = qe.id
       WHERE p.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/projects
const createProject = async (req, res) => {
  try {
    const {
      project_code, name, type, description,
      client_name, client_gstin, client_pan,
      location, city, state,
      rera_number, nhai_contract, contract_value,
      start_date, end_date,
      project_manager_id, site_engineer_id, qs_engineer_id,
      gst_type
    } = req.body;

    const result = await query(
      `INSERT INTO projects (
        company_id, project_code, name, type, description,
        client_name, client_gstin, client_pan,
        location, city, state,
        rera_number, nhai_contract, contract_value,
        start_date, end_date,
        project_manager_id, site_engineer_id, qs_engineer_id,
        gst_type, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'active')
      RETURNING *`,
      [
        req.user.company_id, project_code, name, type, description,
        client_name, client_gstin, client_pan,
        location, city, state,
        rera_number, nhai_contract, contract_value,
        start_date, end_date,
        project_manager_id, site_engineer_id, qs_engineer_id,
        gst_type || 'intra'
      ]
    );
    res.status(201).json({ message: 'Project created successfully.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Project code already exists.' });
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/v1/projects/:id
const updateProject = async (req, res) => {
  try {
    const fields = ['name', 'type', 'description', 'client_name', 'client_gstin',
      'location', 'city', 'state', 'contract_value', 'start_date', 'end_date',
      'project_manager_id', 'site_engineer_id', 'qs_engineer_id',
      'status', 'progress_pct', 'gst_type', 'rera_number'];

    const updates = [];
    const params = [];
    let i = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${i++}`);
        params.push(req.body[field]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });

    params.push(req.params.id, req.user.company_id);
    const result = await query(
      `UPDATE projects SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${i++} AND company_id = $${i} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Project not found.' });
    res.json({ message: 'Project updated.', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/v1/projects/:id
const deleteProject = async (req, res) => {
  console.log(`DELETE request for project ${req.params.id} from user ${req.user.id} (Company: ${req.user.company_id})`);
  try {
    const result = await query(
      'UPDATE projects SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Project not found or you are not authorized to delete it.' });
    }
    res.json({ message: 'Project deactivated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/projects/:id/dashboard
const getProjectDashboard = async (req, res) => {
  try {
    const pid = req.params.id;
    const projectCheck = await query(
      'SELECT 1 FROM projects WHERE id = $1 AND company_id = $2',
      [pid, req.user.company_id]
    );

    if (!projectCheck.rows[0]) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const [boq, billing, workers, incidents, materials] = await Promise.all([
      query(`SELECT COUNT(*) as items, COALESCE(SUM(amount),0) as total_value FROM boq_items WHERE project_id = $1`, [pid]),
      query(`SELECT COALESCE(SUM(gross_amount),0) as billed, COALESCE(SUM(net_payable),0) as certified FROM ra_bills WHERE project_id = $1 AND status = 'certified'`, [pid]),
      query(`SELECT COUNT(*) as total FROM workers WHERE project_id = $1 AND is_active = true`, [pid]),
      query(`SELECT COUNT(*) as open FROM incidents WHERE project_id = $1 AND status != 'closed'`, [pid]),
      query(`SELECT material_name, closing_stock, minimum_level FROM inventory WHERE project_id = $1 AND closing_stock < minimum_level`, [pid])
    ]);

    res.json({
      boq: boq.rows[0],
      billing: billing.rows[0],
      workers: workers.rows[0],
      incidents: incidents.rows[0],
      low_stock_materials: materials.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, getProjectDashboard };
