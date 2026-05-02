// src/routes/documents.routes.js
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuid } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const { uploadToOneDrive, isConfigured } = require('../services/onedrive.service');

router.use(authenticate);

// ── Multer ─────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname)}`),
});
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg','.jpeg','.png','.pdf','.xlsx','.docx','.dwg','.dxf','.zip'];
  path.extname(file.originalname).toLowerCase();
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 25 * 1024 * 1024 } });

// ── Ensure table exists ────────────────────────────────────────────────────
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id       uuid NOT NULL,
      project_id       uuid,
      module           varchar(60) NOT NULL DEFAULT 'general',
      module_record_id uuid,
      file_name        varchar(255) NOT NULL,
      file_type        varchar(10),
      file_size        integer,
      local_url        text,
      onedrive_id      text,
      onedrive_url     text,
      onedrive_web_url text,
      tags             text[] DEFAULT '{}',
      uploaded_by      uuid,
      created_at       timestamptz DEFAULT now()
    )
  `);
}
ensureTable().catch(console.error);

// ── GET /documents ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { project_id, module, search } = req.query;
    let sql = `
      SELECT d.*, p.name as project_name, u.name as uploader_name
      FROM documents d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u    ON d.uploaded_by = u.id
      WHERE d.company_id = $1`;
    const params = [req.user.company_id]; let i = 2;
    if (project_id) { sql += ` AND d.project_id = $${i++}`; params.push(project_id); }
    if (module)     { sql += ` AND d.module = $${i++}`;     params.push(module); }
    if (search)     { sql += ` AND d.file_name ILIKE $${i++}`; params.push(`%${search}%`); }
    sql += ' ORDER BY d.created_at DESC LIMIT 200';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /documents/upload ─────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { project_id, module = 'general', module_record_id, tags } = req.body;

    // Resolve project name for OneDrive folder path
    let projectName = 'General';
    if (project_id) {
      const pr = await query('SELECT name FROM projects WHERE id=$1', [project_id]);
      if (pr.rows.length) projectName = pr.rows[0].name;
    }

    const localUrl  = `/uploads/documents/${req.file.filename}`;
    const localPath = req.file.path;
    const ext       = path.extname(req.file.originalname).slice(1).toLowerCase();

    // Try OneDrive upload
    let onedriveData = null;
    try {
      onedriveData = await uploadToOneDrive(localPath, req.file.originalname, module, projectName);
    } catch (odErr) {
      console.warn('OneDrive upload skipped:', odErr.message);
    }

    const result = await query(
      `INSERT INTO documents
         (company_id, project_id, module, module_record_id, file_name, file_type, file_size,
          local_url, onedrive_id, onedrive_url, onedrive_web_url, tags, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        req.user.company_id,
        project_id || null,
        module,
        module_record_id || null,
        req.file.originalname,
        ext,
        req.file.size,
        localUrl,
        onedriveData?.onedrive_id   || null,
        onedriveData?.onedrive_url  || null,
        onedriveData?.onedrive_web_url || null,
        tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
        req.user.id,
      ]
    );

    res.status(201).json({
      data: result.rows[0],
      onedrive_synced: !!onedriveData,
      onedrive_configured: isConfigured(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /documents/modules ─────────────────────────────────────────────────
router.get('/modules', async (req, res) => {
  try {
    const result = await query(
      `SELECT module, COUNT(*) as count FROM documents WHERE company_id=$1 GROUP BY module ORDER BY count DESC`,
      [req.user.company_id]
    );
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /documents/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const doc = await query(
      `DELETE FROM documents WHERE id=$1 AND company_id=$2 RETURNING *`,
      [req.params.id, req.user.company_id]
    );
    if (!doc.rows.length) return res.status(404).json({ error: 'Document not found' });

    // Remove local file
    const localPath = path.join(__dirname, '../../', doc.rows[0].local_url || '');
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
