// ============================================================
// dwgRoutes.js  –  DWG Upload & Quantity API
// Mount: app.use('/api/dwg', require('./dwgRoutes'))
// npm install multer
// ============================================================

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const db       = require('./db');
const { processDWG } = require('./apsService');

// File upload config
const upload = multer({
  dest: 'uploads/dwg/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.dwg', '.dxf'].includes(ext)) cb(null, true);
    else cb(new Error('Only .dwg and .dxf files allowed'));
  }
});

// ── POST /api/dwg/upload ──────────────────────────────────────
// Upload DWG → process via APS → return quantities
router.post('/upload', upload.single('drawing'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { project_ref, work_order, slab_thickness = 150 } = req.body;

  try {
    // Save upload record
    const uploadId = db.prepare(`
      INSERT INTO dwg_uploads (filename, original_name, project_ref, work_order, status, uploaded_at)
      VALUES (?, ?, ?, ?, 'processing', datetime('now'))
    `).run(req.file.filename, req.file.originalname, project_ref || '', work_order || '').lastInsertRowid;

    // Process asynchronously — return uploadId immediately
    res.json({ success: true, uploadId, message: 'Processing started. Poll /api/dwg/status/:id' });

    // Background processing
    processDWG(req.file.path)
      .then(result => {
        // Save quantities to DB
        const stmt = db.prepare(`
          INSERT INTO dwg_quantities
            (upload_id, drawing_name, category, layer, element, measure, quantity, unit, project_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction(rows => {
          for (const row of rows) stmt.run(
            uploadId, row.drawing, row.category, row.layer,
            row.element || '', row.measure, row.quantity, row.unit, project_ref || ''
          );
        });
        insertMany(result.quantities);

        db.prepare(`UPDATE dwg_uploads SET status='done', qty_count=? WHERE id=?`)
          .run(result.quantities.length, uploadId);

        console.log(`[DWG] Upload ${uploadId} done — ${result.quantities.length} rows`);
      })
      .catch(err => {
        db.prepare(`UPDATE dwg_uploads SET status='failed', error=? WHERE id=?`)
          .run(err.message, uploadId);
        console.error(`[DWG] Upload ${uploadId} failed:`, err.message);
      })
      .finally(() => {
        // Clean up temp file
        try { fs.unlinkSync(req.file.path); } catch {}
      });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dwg/status/:id ───────────────────────────────────
router.get('/status/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM dwg_uploads WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// ── GET /api/dwg/quantities/:uploadId ────────────────────────
router.get('/quantities/:uploadId', (req, res) => {
  const { category, measure } = req.query;
  let sql = `SELECT * FROM dwg_quantities WHERE upload_id = ?`;
  const params = [req.params.uploadId];
  if (category) { sql += ` AND category = ?`; params.push(category); }
  if (measure)  { sql += ` AND measure = ?`;  params.push(measure); }
  sql += ` ORDER BY category, layer`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// ── GET /api/dwg/uploads ──────────────────────────────────────
router.get('/uploads', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM dwg_uploads ORDER BY uploaded_at DESC LIMIT 50
  `).all();
  res.json(rows);
});

// ── POST /api/dwg/push-to-boq ────────────────────────────────
// Push selected quantities into the BOQ table
router.post('/push-to-boq', (req, res) => {
  const { upload_id, project_ref, work_order, selected_ids } = req.body;

  let sql = `SELECT * FROM dwg_quantities WHERE upload_id = ?`;
  const params = [upload_id];
  if (selected_ids?.length) {
    sql += ` AND id IN (${selected_ids.map(() => '?').join(',')})`;
    params.push(...selected_ids);
  }
  const rows = db.prepare(sql).all(...params);

  // Map to BOQ items
  const stmt = db.prepare(`
    INSERT INTO boq_items
      (work_order, description, unit, quantity, source, drawing_ref, created_at)
    VALUES (?, ?, ?, ?, 'AutoCAD-DWG', ?, datetime('now'))
  `);
  const insertAll = db.transaction(items => {
    for (const item of items) {
      stmt.run(
        work_order || item.project_ref,
        `${item.category} — ${item.layer} (${item.measure})`,
        item.unit,
        item.quantity,
        item.drawing_name,
      );
    }
  });

  try {
    insertAll(rows);
    res.json({ success: true, pushed: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/dwg/import-csv ─────────────────────────────────
// Import CSV exported from AutoCAD LISP script
const csvUpload = multer({ dest: 'uploads/csv/' });
router.post('/import-csv', csvUpload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV uploaded' });
  const { project_ref, work_order } = req.body;

  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines   = content.split('\n').filter(l => l.trim() && !l.startsWith('Drawing:'));
    const rows    = [];

    for (let i = 1; i < lines.length; i++) { // skip header
      const cols = lines[i].split(',');
      if (cols.length < 6) continue;
      const [drawing, category, layer, measure, quantity, unit] = cols.map(c => c.trim());
      if (!category || !quantity || isNaN(parseFloat(quantity))) continue;
      rows.push({ drawing, category, layer, measure, quantity: parseFloat(quantity), unit, project_ref });
    }

    // Insert as a pseudo-upload
    const uploadId = db.prepare(`
      INSERT INTO dwg_uploads (filename, original_name, project_ref, work_order, status, uploaded_at)
      VALUES (?, ?, ?, ?, 'done', datetime('now'))
    `).run(req.file.filename, req.file.originalname, project_ref || '', work_order || '').lastInsertRowid;

    const stmt = db.prepare(`
      INSERT INTO dwg_quantities (upload_id, drawing_name, category, layer, element, measure, quantity, unit, project_ref)
      VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)
    `);
    const insertAll = db.transaction(items => {
      for (const r of items) stmt.run(uploadId, r.drawing || 'CSV Import', r.category, r.layer || '', r.measure, r.quantity, r.unit, r.project_ref);
    });
    insertAll(rows);

    db.prepare(`UPDATE dwg_uploads SET qty_count=? WHERE id=?`).run(rows.length, uploadId);
    fs.unlinkSync(req.file.path);

    res.json({ success: true, uploadId, rows: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
