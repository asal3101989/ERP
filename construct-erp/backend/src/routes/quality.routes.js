// src/routes/quality.routes.js
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const dayjs = require('dayjs');

router.use(authenticate);

// --- 1. Drawing Register (The Source of Truth) ---
router.get('/drawings', async (req, res) => {
    const { project_id } = req.query;
    let sql = `SELECT d.*, p.name as project_name 
               FROM quality_drawings d 
               JOIN projects p ON d.project_id = p.id 
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    if (project_id) { sql += ` AND d.project_id = $2`; params.push(project_id); }
    sql += ' ORDER BY d.drawing_number ASC';
    const r = await query(sql, params);
    res.json({ data: r.rows });
});

router.post('/drawings', authorize('admin', 'project_manager'), async (req, res) => {
    const { project_id, drawing_number, title, discipline, revision, status, file_path } = req.body;
    const r = await query(
        `INSERT INTO quality_drawings (project_id, drawing_number, title, discipline, revision, status, file_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [project_id, drawing_number, title, discipline, revision || '0', status || 'ifc', file_path]
    );
    res.status(201).json({ data: r.rows[0] });
});

// --- 2. Material Submittals ---
router.get('/submittals', async (req, res) => {
    const r = await query(
        `SELECT s.*, p.name as project_name, v.name as vendor_name
         FROM quality_submittals s
         JOIN projects p ON s.project_id = p.id
         LEFT JOIN vendors v ON s.vendor_id = v.id
         WHERE p.company_id = $1 ORDER BY s.created_at DESC`,
        [req.user.company_id]
    );
    res.json({ data: r.rows });
});

// --- 3. Enhanced RFI Sign-off ---
router.get('/rfi', async (req, res) => {
    const { project_id, status } = req.query;
    let sql = `SELECT q.*, p.name as project_name, u1.name as raised_by_name, u2.name as inspected_by_name, 
               c.name as checklist_name, d.drawing_number, d.title as drawing_title
               FROM quality_rfis q
               JOIN projects p ON q.project_id = p.id
               LEFT JOIN users u1 ON q.raised_by = u1.id
               LEFT JOIN users u2 ON q.inspected_by = u2.id
               LEFT JOIN quality_checklists c ON q.checklist_id = c.id
               LEFT JOIN quality_drawings d ON q.drawing_id = d.id
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let i = 2;
    if (project_id) { sql += ` AND q.project_id = $${i++}`; params.push(project_id); }
    if (status) { sql += ` AND q.status = $${i++}`; params.push(status); }
    sql += ' ORDER BY q.created_at DESC';
    res.json({ data: (await query(sql, params)).rows });
});

router.post('/rfi', async (req, res) => {
    const { project_id, checklist_id, drawing_id, location, activity_name, scheduled_at, inspection_type } = req.body;
    const count = (await query('SELECT COUNT(*) FROM quality_rfis')).rows[0].count;
    const num = `RFI-${dayjs().year()}-${String(parseInt(count) + 1).padStart(4, '0')}`;
    const r = await query(
        `INSERT INTO quality_rfis (project_id, rfi_number, checklist_id, drawing_id, location, activity_name, scheduled_at, inspection_type, raised_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'raised') RETURNING *`,
        [project_id, num, checklist_id, drawing_id, location, activity_name, scheduled_at, inspection_type || 'internal', req.user.id]
    );
    res.status(201).json({ data: r.rows[0] });
});

router.patch('/rfi/:id/sign', async (req, res) => {
    const { role, name, sign_data } = req.body;
    const rfi = (await query('SELECT signatures FROM quality_rfis WHERE id=$1', [req.params.id])).rows[0];
    const sigs = rfi.signatures || [];
    sigs.push({ role, name, sign_data, date: new Date() });
    
    const r = await query(
        'UPDATE quality_rfis SET signatures=$1 WHERE id=$2 RETURNING *',
        [JSON.stringify(sigs), req.params.id]
    );
    res.json({ data: r.rows[0] });
});

router.patch('/rfi/:id/inspect', authorize('admin', 'quality_manager'), async (req, res) => {
    const { status, remarks } = req.body;
    const r = await query(
        `UPDATE quality_rfis SET status=$1, remarks=$2, inspected_by=$3, inspected_at=NOW()
         WHERE id=$4 RETURNING *`,
        [status, remarks || null, req.user.id, req.params.id]
    );
    res.json({ data: r.rows[0] });
});

// --- 4. Forensic NCR Lifecycle ---
router.get('/ncr', async (req, res) => {
    const r = await query(
        `SELECT n.*, p.name as project_name, u1.name as raised_by_name, u2.name as assigned_to_name,
         r.rfi_number, r.activity_name as rfi_activity
         FROM quality_ncrs n
         JOIN projects p ON n.project_id = p.id
         LEFT JOIN users u1 ON n.raised_by = u1.id
         LEFT JOIN users u2 ON n.assigned_to = u2.id
         LEFT JOIN quality_rfis r ON n.rfi_id = r.id
         WHERE p.company_id = $1 ORDER BY n.created_at DESC`,
        [req.user.company_id]
    );
    res.json({ data: r.rows });
});

router.post('/ncr', async (req, res) => {
    const { project_id, rfi_id, title, description, assigned_to, priority, issue_type } = req.body;
    const count = (await query('SELECT COUNT(*) FROM quality_ncrs')).rows[0].count;
    const num = `NCR-${dayjs().year()}-${String(parseInt(count) + 1).padStart(4, '0')}`;
    
    const r = await query(
        `INSERT INTO quality_ncrs (project_id, ncr_number, rfi_id, title, description, raised_by, assigned_to, priority, issue_type, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open') RETURNING *`,
        [project_id, num, rfi_id || null, title, description, req.user.id, assigned_to || null, priority || 'medium', issue_type || 'quality']
    );
    res.status(201).json({ data: r.rows[0] });
});

router.patch('/ncr/:id/rca', authorize('admin', 'hse_officer'), async (req, res) => {
    const { rca_method, rca_details, rectification_plan, resolution_deadline } = req.body;
    const r = await query(
        `UPDATE quality_ncrs SET rca_method=$1, rca_details=$2, rectification_plan=$3, resolution_deadline=$4, status='under_review'
         WHERE id=$5 RETURNING *`,
        [rca_method, JSON.stringify(rca_details), rectification_plan, resolution_deadline, req.params.id]
    );
    res.json({ data: r.rows[0] });
});

router.patch('/ncr/:id/verify', authorize('admin', 'hse_officer'), async (req, res) => {
    const { evidence_after, remarks } = req.body;
    const r = await query(
        `UPDATE quality_ncrs SET evidence_after=$1, status='closed', closed_at=NOW()
         WHERE id=$2 RETURNING *`,
        [JSON.stringify(evidence_after), req.params.id]
    );
    res.json({ data: r.rows[0] });
});

// --- 5. Shared Checklist API ---
router.get('/checklists', async (req, res) => {
    const r = await query('SELECT * FROM quality_checklists WHERE company_id=$1 AND is_active=true', [req.user.company_id]);
    res.json({ data: r.rows });
});

router.post('/checklists', authorize('admin', 'quality_manager'), async (req, res) => {
    const { name, category, items } = req.body;
    const r = await query(
        `INSERT INTO quality_checklists (company_id, name, category, items, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [req.user.company_id, name, category || 'general', JSON.stringify(items || []), req.user.id]
    );
    res.status(201).json({ data: r.rows[0] });
});

// --- 6. Lab Tests ---
router.get('/lab-tests', async (req, res) => {
    const { project_id } = req.query;
    let sql = `SELECT l.*, p.name as project_name, u.name as requested_by_name 
               FROM quality_lab_tests l 
               JOIN projects p ON l.project_id = p.id 
               LEFT JOIN users u ON l.requested_by = u.id
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    if (project_id) { sql += ` AND l.project_id = $2`; params.push(project_id); }
    sql += ' ORDER BY l.created_at DESC';
    const r = await query(sql, params);
    res.json({ data: r.rows });
});

router.post('/lab-tests', async (req, res) => {
    const { project_id, material_name, test_name, lab_name, request_date, status, result } = req.body;
    const count = (await query('SELECT COUNT(*) FROM quality_lab_tests')).rows[0].count;
    const num = `LT-${dayjs().year()}-${String(parseInt(count) + 1).padStart(4, '0')}`;

    const r = await query(
        `INSERT INTO quality_lab_tests (project_id, test_number, material_name, test_name, lab_name, request_date, status, result, requested_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [project_id, num, material_name, test_name, lab_name, request_date || new Date(), status || 'pending', result || null, req.user.id]
    );
    res.status(201).json({ data: r.rows[0] });
});

module.exports = router;
