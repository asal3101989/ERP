// src/routes/planning.routes.js
// Planning & Execution Module — all endpoints

const express = require('express');
const router  = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { authenticate, authorize } = require('../middleware/auth');

const PLANNERS = ['project_manager', 'site_engineer', 'admin', 'super_admin'];
const MANAGERS = ['project_manager', 'admin', 'super_admin'];
const ADMINS   = ['admin', 'super_admin'];

const dprUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only xlsx/xls files supported'), ok);
  },
});

router.use(authenticate);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const db = () => require('../config/database').pool;

const notFound = (res, entity = 'Record') =>
  res.status(404).json({ error: `${entity} not found` });

const toArray = (value) => Array.isArray(value) ? value : [];

const ensureObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const cellText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (!cleaned || /^#/.test(cleaned)) return '';
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : '';
}

function excelDateToISO(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function parseDPRWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames.find((name) => /^dpr$/i.test(name.trim())) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const get = (r, c) => rows[r]?.[c];
  const findRow = (term) => rows.findIndex((row) =>
    row.some((value) => cellText(value).toLowerCase() === term.toLowerCase())
  );
  const findAfter = (label) => {
    for (const row of rows) {
      const idx = row.findIndex((value) => cellText(value).toLowerCase() === label.toLowerCase());
      if (idx === -1) continue;
      for (let c = idx + 1; c < row.length; c++) {
        if (cellText(row[c])) return row[c];
      }
    }
    return '';
  };

  const reportDate = excelDateToISO(findAfter('Report for'));
  if (!reportDate) throw new Error('Could not find DPR report date in Excel');

  const concrete_today = [];
  const concreteSheetName = wb.SheetNames.find((name) => /concrete\s+consumption/i.test(name));
  if (concreteSheetName) {
    const concreteRows = XLSX.utils.sheet_to_json(wb.Sheets[concreteSheetName], { header: 1, defval: '' });
    const header = concreteRows[0] || [];
    const dateRow = concreteRows.find((row) => excelDateToISO(row[1]) === reportDate);
    if (dateRow) {
      for (let c = 4; c <= 16; c++) {
        const qty = toNumber(dateRow[c]);
        if (qty === '' || Number(qty) === 0) continue;
        concrete_today.push({
          grade: cellText(header[c]),
          supplier: cellText(dateRow[2]) || 'Batching Plant',
          qty,
        });
      }
    }
  }

  const workStart = findRow('WORK PROGRESS');
  const resourcesRow = findRow('RESOURCES');
  const work_items = [];
  if (workStart >= 0) {
    const end = resourcesRow > workStart ? resourcesRow : rows.length;
    for (let r = workStart + 2; r < end; r++) {
      const description = cellText(get(r, 1));
      if (!description) continue;
      work_items.push({
        description,
        unit: cellText(get(r, 8)),
        boq_qty: toNumber(get(r, 9)),
        planned: toNumber(get(r, 10)),
        achieved: toNumber(get(r, 11)),
        cumulative: toNumber(get(r, 12)),
        remarks: '',
      });
    }
  }

  const staff = [];
  const direct_workers = [];
  const subcontractors = [];
  for (let r = 0; r < rows.length; r++) {
    const staffCategory = cellText(get(r, 1));
    const workerCategory = cellText(get(r, 6));
    const subcontractorName = cellText(get(r, 12));

    if (staffCategory && !['CATEGORY', 'TOTAL', 'STAFF'].includes(staffCategory.toUpperCase())) {
      const nos = toNumber(get(r, 5));
      if (nos !== '') staff.push({ category: staffCategory, nos });
    }
    if (workerCategory && !['CATEGORY', 'TOTAL', 'DIRECT WORKERS'].includes(workerCategory.toUpperCase())) {
      const day = toNumber(get(r, 10));
      const night = toNumber(get(r, 11));
      if (day !== '' || night !== '') direct_workers.push({ category: workerCategory, day, night });
    }
    if (subcontractorName && !['NAME', 'SUBCONTRACTORS'].includes(subcontractorName.toUpperCase())) {
      const day = toNumber(get(r, 14));
      const night = toNumber(get(r, 15));
      if (day !== '' || night !== '') {
        subcontractors.push({ subcontract_wo_id: '', vendor_id: '', name: subcontractorName, work: '', day, night });
      }
    }
  }

  const plant_items = [];
  const plantStart = findRow('PLANT & MACHINERY');
  if (plantStart >= 0) {
    for (let r = plantStart + 1; r < rows.length; r++) {
      const item = cellText(get(r, 1));
      if (!item || /^total$/i.test(item)) continue;
      const nos = toNumber(get(r, 5));
      if (nos === '') continue;
      plant_items.push({ item, nos });
    }
  }

  const steel = [];
  const steelStart = rows.findIndex((row) => row.some((value) => /steel\s*fe/i.test(cellText(value))));
  if (steelStart >= 0) {
    for (let r = steelStart + 1; r < rows.length; r++) {
      const dia = cellText(get(r, 6));
      if (!dia || /^total$/i.test(dia)) break;
      steel.push({
        dia: dia.replace(/\s+dia$/i, 'mm'),
        receipts_today: toNumber(get(r, 10)),
        receipts_till_date: toNumber(get(r, 11)),
        available: toNumber(get(r, 12)),
        consumption: toNumber(get(r, 14)),
      });
    }
  }

  return {
    report_date: reportDate,
    weather: 'normal',
    site_conditions: 'Dry',
    rain_log: cellText(findAfter('Rain Log')),
    work_items,
    concrete_today,
    staff,
    direct_workers,
    subcontractors,
    plant_items,
    steel,
    constraints: '',
    rfi: '',
    prepared_by: '',
    approved_by: '',
    status: 'submitted',
  };
}

function buildPlanningDPRResponse(row) {
  const workDone = toArray(row.work_done);
  const materialConsumed = ensureObject(row.material_consumed);
  const equipmentStatus = ensureObject(row.equipment_status);
  const directWorkers = toArray(equipmentStatus.direct_workers);
  const subcontractors = toArray(equipmentStatus.subcontractors);

  return {
    id: row.id,
    project_id: row.project_id,
    dpr_number: row.dpr_number,
    report_date: row.report_date,
    status: row.status || 'draft',
    weather: row.weather || 'normal',
    site_conditions: equipmentStatus.site_conditions || 'Dry',
    rain_log: equipmentStatus.rain_log || '',
    work_items: workDone,
    concrete_today: toArray(materialConsumed.concrete_today),
    staff: toArray(equipmentStatus.staff),
    direct_workers: directWorkers,
    subcontractors: subcontractors,
    plant_items: toArray(equipmentStatus.plant_items),
    steel: toArray(materialConsumed.steel),
    constraints: equipmentStatus.constraints || row.issues || '',
    rfi: equipmentStatus.rfi || row.tomorrow_plan || '',
    prepared_by: equipmentStatus.prepared_by || row.submitted_by_name || '',
    approved_by: equipmentStatus.approved_by || '',
    created_at: row.created_at,
    updated_at: row.created_at,
    created_by_id: row.submitted_by,
    approved_at: equipmentStatus.approved_at || null,
    project_name: row.project_name,
    submitted_by_name: row.submitted_by_name,
    total_workers: directWorkers.reduce((sum, item) => sum + (Number(item.day) || 0) + (Number(item.night) || 0), 0)
      + subcontractors.reduce((sum, item) => sum + (Number(item.day) || 0) + (Number(item.night) || 0), 0),
    activities_count: workDone.length,
    photos_count: Array.isArray(row.site_photos) ? row.site_photos.length : 0,
  };
}

function buildPlanningDPRStorage(payload) {
  return {
    weather: payload.weather || 'normal',
    work_done: toArray(payload.work_items),
    material_consumed: {
      concrete_today: toArray(payload.concrete_today),
      steel: toArray(payload.steel),
    },
    equipment_status: {
      site_conditions: payload.site_conditions || 'Dry',
      rain_log: payload.rain_log || '',
      staff: toArray(payload.staff),
      direct_workers: toArray(payload.direct_workers),
      subcontractors: toArray(payload.subcontractors),
      plant_items: toArray(payload.plant_items),
      constraints: payload.constraints || '',
      rfi: payload.rfi || '',
      prepared_by: payload.prepared_by || '',
      approved_by: payload.approved_by || '',
      approved_at: payload.approved_at || null,
    },
    issues: payload.constraints || '',
    tomorrow_plan: payload.rfi || '',
    status: payload.status || 'draft',
  };
}

// GET /planning/dpr?project_id=
router.get('/dpr', async (req, res) => {
  try {
    const { project_id } = req.query;
    const params = [req.user.company_id];
    let sql = `
      SELECT d.*, p.name AS project_name, u.name AS submitted_by_name
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      LEFT JOIN users u ON u.id = d.submitted_by
      WHERE p.company_id = $1
    `;

    if (project_id) {
      params.push(project_id);
      sql += ` AND d.project_id = $${params.length}`;
    }

    sql += ' ORDER BY d.report_date DESC, d.created_at DESC';
    const { rows } = await db().query(sql, params);
    res.json({ data: rows.map(buildPlanningDPRResponse) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /planning/dpr/:id
router.get('/dpr/:id', async (req, res) => {
  try {
    const { rows } = await db().query(`
      SELECT d.*, p.name AS project_name, u.name AS submitted_by_name
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      LEFT JOIN users u ON u.id = d.submitted_by
      WHERE d.id = $1 AND p.company_id = $2
    `, [req.params.id, req.user.company_id]);

    if (!rows.length) return notFound(res, 'DPR');
    res.json({ data: buildPlanningDPRResponse(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/dpr
router.post('/dpr', authorize(PLANNERS), async (req, res) => {
  try {
    const { project_id, report_date } = req.body;
    if (!project_id || !report_date) {
      return res.status(400).json({ error: 'project_id and report_date are required' });
    }

    const projectCheck = await db().query(
      `SELECT id FROM projects WHERE id = $1 AND company_id = $2`,
      [project_id, req.user.company_id]
    );
    if (!projectCheck.rows.length) return notFound(res, 'Project');

    const stored = buildPlanningDPRStorage(req.body);
    const dprNumber = `PDPR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { rows } = await db().query(`
      INSERT INTO daily_progress_reports
        (project_id, dpr_number, report_date, weather, work_done, material_consumed,
         equipment_status, issues, tomorrow_plan, site_photos, submitted_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      project_id,
      dprNumber,
      report_date,
      stored.weather,
      JSON.stringify(stored.work_done),
      JSON.stringify(stored.material_consumed),
      JSON.stringify(stored.equipment_status),
      stored.issues,
      stored.tomorrow_plan,
      [],
      req.user.id,
      stored.status,
    ]);

    const result = await db().query(`
      SELECT d.*, p.name AS project_name, u.name AS submitted_by_name
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      LEFT JOIN users u ON u.id = d.submitted_by
      WHERE d.id = $1
    `, [rows[0].id]);

    res.status(201).json({ data: buildPlanningDPRResponse(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/dpr/import
router.post('/dpr/import', authorize(PLANNERS), dprUpload.single('file'), async (req, res) => {
  try {
    const { project_id, overwrite } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });
    if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

    const projectCheck = await db().query(
      `SELECT id FROM projects WHERE id = $1 AND company_id = $2`,
      [project_id, req.user.company_id]
    );
    if (!projectCheck.rows.length) return notFound(res, 'Project');

    const parsed = parseDPRWorkbook(req.file.buffer);
    const stored = buildPlanningDPRStorage(parsed);
    const existing = await db().query(
      `SELECT d.id
       FROM daily_progress_reports d
       JOIN projects p ON p.id = d.project_id
       WHERE d.project_id = $1 AND d.report_date = $2 AND p.company_id = $3
       ORDER BY d.created_at DESC
       LIMIT 1`,
      [project_id, parsed.report_date, req.user.company_id]
    );

    let dprId = existing.rows[0]?.id;
    let mode = 'inserted';

    if (dprId && overwrite !== 'false') {
      mode = 'updated';
      await db().query(`
        UPDATE daily_progress_reports
        SET weather = $1,
            work_done = $2,
            material_consumed = $3,
            equipment_status = $4,
            issues = $5,
            tomorrow_plan = $6,
            status = $7
        WHERE id = $8
      `, [
        stored.weather,
        JSON.stringify(stored.work_done),
        JSON.stringify(stored.material_consumed),
        JSON.stringify(stored.equipment_status),
        stored.issues,
        stored.tomorrow_plan,
        stored.status,
        dprId,
      ]);
    } else if (dprId) {
      return res.status(409).json({ error: 'DPR already exists for this date' });
    } else {
      const dprNumber = `PDPR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const inserted = await db().query(`
        INSERT INTO daily_progress_reports
          (project_id, dpr_number, report_date, weather, work_done, material_consumed,
           equipment_status, issues, tomorrow_plan, site_photos, submitted_by, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id
      `, [
        project_id,
        dprNumber,
        parsed.report_date,
        stored.weather,
        JSON.stringify(stored.work_done),
        JSON.stringify(stored.material_consumed),
        JSON.stringify(stored.equipment_status),
        stored.issues,
        stored.tomorrow_plan,
        [],
        req.user.id,
        stored.status,
      ]);
      dprId = inserted.rows[0].id;
    }

    const result = await db().query(`
      SELECT d.*, p.name AS project_name, u.name AS submitted_by_name
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      LEFT JOIN users u ON u.id = d.submitted_by
      WHERE d.id = $1
    `, [dprId]);

    res.json({
      data: buildPlanningDPRResponse(result.rows[0]),
      summary: {
        mode,
        report_date: parsed.report_date,
        work_items: parsed.work_items.length,
        staff: parsed.staff.length,
        direct_workers: parsed.direct_workers.length,
        subcontractors: parsed.subcontractors.length,
        plant_items: parsed.plant_items.length,
        steel: parsed.steel.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to import DPR' });
  }
});

// PUT /planning/dpr/:id
router.put('/dpr/:id', authorize(PLANNERS), async (req, res) => {
  try {
    const existing = await db().query(`
      SELECT d.*
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = $1 AND p.company_id = $2
    `, [req.params.id, req.user.company_id]);

    if (!existing.rows.length) return notFound(res, 'DPR');

    const merged = buildPlanningDPRStorage({
      ...buildPlanningDPRResponse(existing.rows[0]),
      ...req.body,
    });

    await db().query(`
      UPDATE daily_progress_reports
      SET report_date = $1,
          weather = $2,
          work_done = $3,
          material_consumed = $4,
          equipment_status = $5,
          issues = $6,
          tomorrow_plan = $7,
          status = $8
      WHERE id = $9
    `, [
      req.body.report_date || existing.rows[0].report_date,
      merged.weather,
      JSON.stringify(merged.work_done),
      JSON.stringify(merged.material_consumed),
      JSON.stringify(merged.equipment_status),
      merged.issues,
      merged.tomorrow_plan,
      req.body.status || existing.rows[0].status || 'draft',
      req.params.id,
    ]);

    const refreshed = await db().query(`
      SELECT d.*, p.name AS project_name, u.name AS submitted_by_name
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      LEFT JOIN users u ON u.id = d.submitted_by
      WHERE d.id = $1
    `, [req.params.id]);

    res.json({ data: buildPlanningDPRResponse(refreshed.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /planning/dpr/:id/approve
router.patch('/dpr/:id/approve', authorize(MANAGERS), async (req, res) => {
  try {
    const existing = await db().query(`
      SELECT d.*
      FROM daily_progress_reports d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = $1 AND p.company_id = $2
    `, [req.params.id, req.user.company_id]);

    if (!existing.rows.length) return notFound(res, 'DPR');

    const equipmentStatus = ensureObject(existing.rows[0].equipment_status);
    equipmentStatus.approved_by = req.user.name || equipmentStatus.approved_by || 'Approved';
    equipmentStatus.approved_at = new Date().toISOString();

    await db().query(`
      UPDATE daily_progress_reports
      SET status = 'approved',
          equipment_status = $1
      WHERE id = $2
    `, [JSON.stringify(equipmentStatus), req.params.id]);

    res.json({ data: { id: req.params.id, status: 'approved' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /planning/dpr/:id
router.delete('/dpr/:id', authorize(MANAGERS), async (req, res) => {
  try {
    const { rowCount } = await db().query(`
      DELETE FROM daily_progress_reports d
      USING projects p
      WHERE d.project_id = p.id
        AND d.id = $1
        AND p.company_id = $2
    `, [req.params.id, req.user.company_id]);

    if (!rowCount) return notFound(res, 'DPR');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────

// GET /planning/activities?project_id=&status=&type=
router.get('/activities', async (req, res) => {
  try {
    const { project_id, status, type } = req.query;
    const conditions = [];
    const params = [];

    if (project_id) { params.push(project_id); conditions.push(`a.project_id = $${params.length}`); }
    if (status)     { params.push(status);     conditions.push(`a.status = $${params.length}`); }
    if (type)       { params.push(type);        conditions.push(`a.activity_type = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db().query(`
      SELECT a.*,
             u.name AS assigned_to_name,
             p.name AS project_name
      FROM   project_activities a
      LEFT JOIN users    u ON u.id = a.assigned_to
      LEFT JOIN projects p ON p.id = a.project_id
      ${where}
      ORDER BY a.baseline_start_date ASC, a.activity_code ASC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /planning/activities/:id
router.get('/activities/:id', async (req, res) => {
  try {
    const { rows } = await db().query(`
      SELECT a.*,
             u.name  AS assigned_to_name,
             p.name  AS project_name,
             b.description AS boq_description
      FROM   project_activities a
      LEFT JOIN users     u ON u.id = a.assigned_to
      LEFT JOIN projects  p ON p.id = a.project_id
      LEFT JOIN boq_items b ON b.id = a.boq_item_id
      WHERE  a.id = $1
    `, [req.params.id]);

    if (!rows.length) return notFound(res, 'Activity');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/activities
router.post('/activities', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      project_id, activity_code, activity_name, description, location,
      activity_type, baseline_start_date, baseline_end_date, baseline_duration,
      is_critical_path, slack_days, boq_item_id, planned_quantity,
      measurement_unit, assigned_to,
    } = req.body;

    if (!project_id || !activity_code || !activity_name || !baseline_start_date || !baseline_end_date) {
      return res.status(400).json({ error: 'project_id, activity_code, activity_name, baseline_start_date, baseline_end_date are required' });
    }

    const dur = baseline_duration ||
      Math.ceil((new Date(baseline_end_date) - new Date(baseline_start_date)) / 86400000);

    const { rows } = await db().query(`
      INSERT INTO project_activities
        (project_id, activity_code, activity_name, description, location,
         activity_type, baseline_start_date, baseline_end_date, baseline_duration,
         is_critical_path, slack_days, boq_item_id, planned_quantity,
         measurement_unit, assigned_to, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      project_id, activity_code, activity_name, description || null, location || null,
      activity_type || null, baseline_start_date, baseline_end_date, dur,
      is_critical_path || false, slack_days || 0,
      boq_item_id || null, planned_quantity || null,
      measurement_unit || null, assigned_to || null, req.user.id,
    ]);

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Activity code already exists for this project' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /planning/activities/:id
router.put('/activities/:id', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      activity_name, description, location, activity_type,
      baseline_start_date, baseline_end_date, baseline_duration,
      actual_start_date, actual_end_date, progress_pct, status,
      is_critical_path, slack_days, planned_quantity, actual_quantity,
      measurement_unit, assigned_to,
    } = req.body;

    const { rows } = await db().query(`
      UPDATE project_activities SET
        activity_name        = COALESCE($1,  activity_name),
        description          = COALESCE($2,  description),
        location             = COALESCE($3,  location),
        activity_type        = COALESCE($4,  activity_type),
        baseline_start_date  = COALESCE($5,  baseline_start_date),
        baseline_end_date    = COALESCE($6,  baseline_end_date),
        baseline_duration    = COALESCE($7,  baseline_duration),
        actual_start_date    = COALESCE($8,  actual_start_date),
        actual_end_date      = COALESCE($9,  actual_end_date),
        progress_pct         = COALESCE($10, progress_pct),
        status               = COALESCE($11, status),
        is_critical_path     = COALESCE($12, is_critical_path),
        slack_days           = COALESCE($13, slack_days),
        planned_quantity     = COALESCE($14, planned_quantity),
        actual_quantity      = COALESCE($15, actual_quantity),
        measurement_unit     = COALESCE($16, measurement_unit),
        assigned_to          = COALESCE($17, assigned_to),
        updated_at           = NOW()
      WHERE id = $18
      RETURNING *
    `, [
      activity_name, description, location, activity_type,
      baseline_start_date, baseline_end_date, baseline_duration,
      actual_start_date || null, actual_end_date || null,
      progress_pct, status, is_critical_path, slack_days,
      planned_quantity, actual_quantity, measurement_unit, assigned_to,
      req.params.id,
    ]);

    if (!rows.length) return notFound(res, 'Activity');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /planning/activities/:id/progress  — quick progress update
router.patch('/activities/:id/progress', authorize(PLANNERS), async (req, res) => {
  try {
    const { progress_pct, actual_quantity, status, actual_start_date, actual_end_date } = req.body;

    // Auto-set status based on progress
    let computedStatus = status;
    if (!computedStatus) {
      if (progress_pct >= 100) computedStatus = 'completed';
      else if (progress_pct > 0) computedStatus = 'in_progress';
    }

    const { rows } = await db().query(`
      UPDATE project_activities SET
        progress_pct      = COALESCE($1, progress_pct),
        actual_quantity   = COALESCE($2, actual_quantity),
        status            = COALESCE($3, status),
        actual_start_date = COALESCE($4, actual_start_date),
        actual_end_date   = COALESCE($5, actual_end_date),
        updated_at        = NOW()
      WHERE id = $6
      RETURNING *
    `, [progress_pct, actual_quantity || null, computedStatus,
        actual_start_date || null, actual_end_date || null, req.params.id]);

    if (!rows.length) return notFound(res, 'Activity');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /planning/activities/:id
router.delete('/activities/:id', authorize(ADMINS), async (req, res) => {
  try {
    const { rowCount } = await db().query(
      `DELETE FROM project_activities WHERE id = $1`, [req.params.id]
    );
    if (!rowCount) return notFound(res, 'Activity');
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MILESTONES ───────────────────────────────────────────────────────────────

// GET /planning/milestones?project_id=
router.get('/milestones', async (req, res) => {
  try {
    const { project_id } = req.query;
    const params = [];
    const where  = project_id ? (params.push(project_id), `WHERE m.project_id = $1`) : '';

    const { rows } = await db().query(`
      SELECT m.*,
             u.name AS verified_by_name,
             p.name AS project_name,
             a.activity_name AS related_activity_name
      FROM   project_milestones m
      LEFT JOIN users             u ON u.id = m.verified_by
      LEFT JOIN projects          p ON p.id = m.project_id
      LEFT JOIN project_activities a ON a.id = m.related_activity_id
      ${where}
      ORDER BY m.target_date ASC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/milestones
router.post('/milestones', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      project_id, milestone_code, milestone_name, description,
      milestone_type, target_date, affects_payment_release,
      related_activity_id, remarks,
    } = req.body;

    if (!project_id || !milestone_code || !milestone_name || !target_date) {
      return res.status(400).json({ error: 'project_id, milestone_code, milestone_name, target_date required' });
    }

    const { rows } = await db().query(`
      INSERT INTO project_milestones
        (project_id, milestone_code, milestone_name, description,
         milestone_type, target_date, affects_payment_release,
         related_activity_id, remarks, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      project_id, milestone_code, milestone_name, description || null,
      milestone_type || null, target_date,
      affects_payment_release || false,
      related_activity_id || null, remarks || null, req.user.id,
    ]);

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /planning/milestones/:id
router.put('/milestones/:id', authorize(PLANNERS), async (req, res) => {
  try {
    const { milestone_name, description, milestone_type, target_date,
            affects_payment_release, related_activity_id, remarks } = req.body;

    const { rows } = await db().query(`
      UPDATE project_milestones SET
        milestone_name          = COALESCE($1, milestone_name),
        description             = COALESCE($2, description),
        milestone_type          = COALESCE($3, milestone_type),
        target_date             = COALESCE($4, target_date),
        affects_payment_release = COALESCE($5, affects_payment_release),
        related_activity_id     = COALESCE($6, related_activity_id),
        remarks                 = COALESCE($7, remarks),
        updated_at              = NOW()
      WHERE id = $8
      RETURNING *
    `, [milestone_name, description, milestone_type, target_date,
        affects_payment_release, related_activity_id || null, remarks, req.params.id]);

    if (!rows.length) return notFound(res, 'Milestone');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /planning/milestones/:id/achieve
router.patch('/milestones/:id/achieve', authorize(MANAGERS), async (req, res) => {
  try {
    const { actual_date, remarks } = req.body;
    if (!actual_date) return res.status(400).json({ error: 'actual_date is required' });

    const { rows } = await db().query(`
      UPDATE project_milestones SET
        is_achieved    = true,
        actual_date    = $1,
        deviation_days = $1::date - target_date,
        remarks        = COALESCE($2, remarks),
        verified_by    = $3,
        updated_at     = NOW()
      WHERE id = $4
      RETURNING *
    `, [actual_date, remarks || null, req.user.id, req.params.id]);

    if (!rows.length) return notFound(res, 'Milestone');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── LOOK-AHEAD PLANS ─────────────────────────────────────────────────────────

// GET /planning/look-ahead?project_id=&week_start=
router.get('/look-ahead', async (req, res) => {
  try {
    const { project_id, week_start } = req.query;
    const params = [];
    const conditions = [];

    if (project_id) { params.push(project_id); conditions.push(`l.project_id = $${params.length}`); }
    if (week_start) { params.push(week_start);  conditions.push(`l.plan_week_start = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db().query(`
      SELECT l.*,
             u1.name AS planned_by_name,
             u2.name AS approved_by_name,
             p.name  AS project_name
      FROM   look_ahead_plans l
      LEFT JOIN users    u1 ON u1.id = l.planned_by
      LEFT JOIN users    u2 ON u2.id = l.approved_by
      LEFT JOIN projects p  ON p.id  = l.project_id
      ${where}
      ORDER BY l.plan_week_start DESC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/look-ahead
router.post('/look-ahead', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      project_id, plan_week_start, plan_week_end,
      planned_activities, planned_manpower, planned_materials,
      planned_equipment, potential_risks, mitigation_measures, dependencies,
    } = req.body;

    if (!project_id || !plan_week_start) {
      return res.status(400).json({ error: 'project_id and plan_week_start are required' });
    }

    // Auto-calculate end: start + 13 days if not provided
    const weekEnd = plan_week_end ||
      new Date(new Date(plan_week_start).getTime() + 13 * 86400000)
        .toISOString().split('T')[0];

    const { rows } = await db().query(`
      INSERT INTO look_ahead_plans
        (project_id, plan_week_start, plan_week_end, planned_activities,
         planned_manpower, planned_materials, planned_equipment,
         potential_risks, mitigation_measures, dependencies, planned_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (project_id, plan_week_start) DO UPDATE SET
        plan_week_end       = EXCLUDED.plan_week_end,
        planned_activities  = EXCLUDED.planned_activities,
        planned_manpower    = EXCLUDED.planned_manpower,
        planned_materials   = EXCLUDED.planned_materials,
        planned_equipment   = EXCLUDED.planned_equipment,
        potential_risks     = EXCLUDED.potential_risks,
        mitigation_measures = EXCLUDED.mitigation_measures,
        dependencies        = EXCLUDED.dependencies,
        updated_at          = NOW()
      RETURNING *
    `, [
      project_id, plan_week_start, weekEnd,
      JSON.stringify(planned_activities || []),
      planned_manpower || null,
      JSON.stringify(planned_materials || []),
      JSON.stringify(planned_equipment || []),
      potential_risks || null, mitigation_measures || null,
      dependencies || null, req.user.id,
    ]);

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /planning/look-ahead/:id/approve
router.patch('/look-ahead/:id/approve', authorize(MANAGERS), async (req, res) => {
  try {
    const { rows } = await db().query(`
      UPDATE look_ahead_plans SET
        status      = 'approved',
        approved_by = $1,
        approved_at = NOW(),
        updated_at  = NOW()
      WHERE id = $2
      RETURNING *
    `, [req.user.id, req.params.id]);

    if (!rows.length) return notFound(res, 'Look-Ahead Plan');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PROGRESS TRACKING ────────────────────────────────────────────────────────

// GET /planning/progress?project_id=&from=&to=&activity_id=
router.get('/progress', async (req, res) => {
  try {
    const { project_id, activity_id, from, to } = req.query;
    const params = [];
    const conditions = [];

    if (project_id)  { params.push(project_id);  conditions.push(`t.project_id = $${params.length}`); }
    if (activity_id) { params.push(activity_id); conditions.push(`t.activity_id = $${params.length}`); }
    if (from)        { params.push(from);         conditions.push(`t.tracking_date >= $${params.length}`); }
    if (to)          { params.push(to);           conditions.push(`t.tracking_date <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db().query(`
      SELECT t.*,
             a.activity_name,
             a.activity_code,
             u.name AS tracked_by_name
      FROM   progress_tracking t
      LEFT JOIN project_activities a ON a.id = t.activity_id
      LEFT JOIN users              u ON u.id = t.tracked_by
      ${where}
      ORDER BY t.tracking_date DESC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/progress
router.post('/progress', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      project_id, activity_id, tracking_date,
      planned_progress_pct, actual_progress_pct,
      planned_qty, actual_qty, planned_manpower, actual_manpower, remarks,
    } = req.body;

    if (!project_id || !tracking_date) {
      return res.status(400).json({ error: 'project_id and tracking_date are required' });
    }

    const { rows } = await db().query(`
      INSERT INTO progress_tracking
        (project_id, activity_id, tracking_date, planned_progress_pct,
         actual_progress_pct, planned_qty, actual_qty, planned_manpower,
         actual_manpower, remarks, tracked_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
      project_id, activity_id || null, tracking_date,
      planned_progress_pct || null, actual_progress_pct || null,
      planned_qty || null, actual_qty || null,
      planned_manpower || null, actual_manpower || null,
      remarks || null, req.user.id,
    ]);

    // Also update activity's progress_pct if activity_id provided
    if (activity_id && actual_progress_pct !== undefined) {
      await db().query(
        `UPDATE project_activities SET progress_pct = $1, updated_at = NOW() WHERE id = $2`,
        [actual_progress_pct, activity_id]
      );
    }

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── S-CURVE ──────────────────────────────────────────────────────────────────

// GET /planning/scurve?project_id=
router.get('/scurve', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const { rows } = await db().query(`
      SELECT * FROM scurve_data
      WHERE  project_id = $1
      ORDER  BY reporting_date ASC
    `, [project_id]);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/scurve/snapshot  — record today's snapshot
router.post('/scurve/snapshot', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      project_id, reporting_date,
      baseline_progress_pct, actual_progress_pct,
      forecast_progress_pct, forecast_completion_date, schedule_variance_days,
    } = req.body;

    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const date = reporting_date || new Date().toISOString().split('T')[0];

    const { rows } = await db().query(`
      INSERT INTO scurve_data
        (project_id, reporting_date, baseline_progress_pct, actual_progress_pct,
         forecast_progress_pct, forecast_completion_date, schedule_variance_days)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (project_id, reporting_date) DO UPDATE SET
        baseline_progress_pct    = EXCLUDED.baseline_progress_pct,
        actual_progress_pct      = EXCLUDED.actual_progress_pct,
        forecast_progress_pct    = EXCLUDED.forecast_progress_pct,
        forecast_completion_date = EXCLUDED.forecast_completion_date,
        schedule_variance_days   = EXCLUDED.schedule_variance_days
      RETURNING *
    `, [
      project_id, date,
      baseline_progress_pct || null, actual_progress_pct || null,
      forecast_progress_pct || null, forecast_completion_date || null,
      schedule_variance_days || null,
    ]);

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELAY ANALYSIS ───────────────────────────────────────────────────────────

// GET /planning/delays?project_id=
router.get('/delays', async (req, res) => {
  try {
    const { project_id } = req.query;
    const params = project_id ? [project_id] : [];
    const where  = project_id ? 'WHERE d.project_id = $1' : '';

    const { rows } = await db().query(`
      SELECT d.*,
             a.activity_name,
             a.activity_code,
             u.name AS analyzed_by_name,
             p.name AS project_name
      FROM   delay_analysis d
      LEFT JOIN project_activities a ON a.id = d.activity_id
      LEFT JOIN users              u ON u.id = d.analyzed_by
      LEFT JOIN projects           p ON p.id = d.project_id
      ${where}
      ORDER  BY d.analysis_date DESC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /planning/delays
router.post('/delays', authorize(PLANNERS), async (req, res) => {
  try {
    const {
      project_id, activity_id, analysis_date, delay_days,
      delay_category, root_cause, impact_on_project,
      mitigation_plan, responsible_party,
    } = req.body;

    if (!project_id || !delay_days) {
      return res.status(400).json({ error: 'project_id and delay_days are required' });
    }

    const { rows } = await db().query(`
      INSERT INTO delay_analysis
        (project_id, activity_id, analysis_date, delay_days, delay_category,
         root_cause, impact_on_project, mitigation_plan, responsible_party, analyzed_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      project_id, activity_id || null,
      analysis_date || new Date().toISOString().split('T')[0],
      delay_days, delay_category || null,
      root_cause || null, impact_on_project || 'minor',
      mitigation_plan || null, responsible_party || null, req.user.id,
    ]);

    res.status(201).json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /planning/delays/:id
router.put('/delays/:id', authorize(PLANNERS), async (req, res) => {
  try {
    const { mitigation_plan, responsible_party, is_resolved } = req.body;

    const { rows } = await db().query(`
      UPDATE delay_analysis SET
        mitigation_plan    = COALESCE($1, mitigation_plan),
        responsible_party  = COALESCE($2, responsible_party),
        is_resolved        = COALESCE($3, is_resolved),
        updated_at         = NOW()
      WHERE id = $4
      RETURNING *
    `, [mitigation_plan, responsible_party, is_resolved, req.params.id]);

    if (!rows.length) return notFound(res, 'Delay record');
    res.json({ data: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────────

// GET /planning/dashboard?project_id=
router.get('/dashboard', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const [actStats, milStats, delayStats, scurve, lookahead] = await Promise.all([
      // Activity summary
      db().query(`
        SELECT
          COUNT(*)                                                       AS total,
          COUNT(*) FILTER (WHERE status = 'completed')                  AS completed,
          COUNT(*) FILTER (WHERE status = 'in_progress')                AS in_progress,
          COUNT(*) FILTER (WHERE status = 'delayed')                    AS delayed,
          COUNT(*) FILTER (WHERE status = 'planned')                    AS planned,
          ROUND(AVG(progress_pct), 1)                                   AS avg_progress,
          COUNT(*) FILTER (WHERE is_critical_path)                      AS critical_count
        FROM project_activities WHERE project_id = $1
      `, [project_id]),

      // Milestone summary
      db().query(`
        SELECT
          COUNT(*)                                           AS total,
          COUNT(*) FILTER (WHERE is_achieved)               AS achieved,
          COUNT(*) FILTER (WHERE NOT is_achieved AND target_date < CURRENT_DATE) AS overdue,
          COUNT(*) FILTER (WHERE NOT is_achieved AND target_date >= CURRENT_DATE
                           AND target_date <= CURRENT_DATE + 30)       AS upcoming
        FROM project_milestones WHERE project_id = $1
      `, [project_id]),

      // Delay summary
      db().query(`
        SELECT
          COUNT(*)                                           AS total,
          SUM(delay_days)                                    AS total_delay_days,
          COUNT(*) FILTER (WHERE impact_on_project = 'critical') AS critical_delays,
          COUNT(*) FILTER (WHERE is_resolved)               AS resolved
        FROM delay_analysis WHERE project_id = $1
      `, [project_id]),

      // Latest S-curve snapshot
      db().query(`
        SELECT * FROM scurve_data
        WHERE project_id = $1 ORDER BY reporting_date DESC LIMIT 1
      `, [project_id]),

      // Current look-ahead
      db().query(`
        SELECT * FROM look_ahead_plans
        WHERE project_id = $1
          AND plan_week_start <= CURRENT_DATE
          AND plan_week_end   >= CURRENT_DATE
        LIMIT 1
      `, [project_id]),
    ]);

    res.json({
      data: {
        activities:  actStats.rows[0],
        milestones:  milStats.rows[0],
        delays:      delayStats.rows[0],
        latest_scurve:   scurve.rows[0] || null,
        current_lookahead: lookahead.rows[0] || null,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
