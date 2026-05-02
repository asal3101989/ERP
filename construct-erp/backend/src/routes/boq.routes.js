const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const { extractBOQItems } = require('../services/boqExtraction.service');

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.use(authenticate);

router.get('/', async (req, res) => {
  const { project_id, chapter } = req.query;
  let sql = `SELECT b.*, p.name as project_name FROM boq_items b
             JOIN projects p ON b.project_id = p.id
             WHERE p.company_id = $1 AND b.is_active = true`;
  const params = [req.user.company_id];
  let i = 2;
  if (project_id) { sql += ` AND b.project_id = $${i++}`; params.push(project_id); }
  if (chapter) { sql += ` AND b.chapter_name ILIKE $${i++}`; params.push(`%${chapter}%`); }
  sql += ' ORDER BY b.chapter_no, b.item_no';
  const result = await query(sql, params);
  res.json({ data: result.rows });
});

router.post('/', authorize('super_admin','admin','qs_engineer','project_manager'), async (req, res) => {
  const { project_id, chapter_no, chapter_name, item_no, sr_no, description, unit, quantity, rate, hsn_code, remarks } = req.body;
  if (!project_id || !description || !unit || quantity == null || rate == null) {
    return res.status(400).json({ error: 'project_id, description, unit, quantity and rate are required' });
  }
  const result = await query(
    `INSERT INTO boq_items (project_id,chapter_no,chapter_name,item_no,sr_no,description,unit,quantity,rate,hsn_code,remarks,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [project_id, chapter_no || null, chapter_name || null, item_no || null, sr_no || null,
     description, unit, parseFloat(quantity), parseFloat(rate), hsn_code || null, remarks || null, req.user.id]
  );
  res.status(201).json({ data: result.rows[0] });
});

router.put('/:id', authorize('super_admin','admin','qs_engineer'), async (req, res) => {
  const { sr_no, description, quantity, rate, remarks } = req.body;
  const result = await query(
    'UPDATE boq_items SET sr_no=$1,description=$2,quantity=$3,rate=$4,remarks=$5,updated_at=NOW() WHERE id=$6 RETURNING *',
    [sr_no, description, quantity, rate, remarks, req.params.id]
  );
  res.json({ data: result.rows[0] });
});

router.delete('/:id', authorize('super_admin','admin'), async (req, res) => {
  await query('UPDATE boq_items SET is_active=false WHERE id=$1', [req.params.id]);
  res.json({ message: 'BOQ item deleted.' });
});

// GET BOQ summary with executed quantities — company scoped
router.get('/summary/:project_id', async (req, res) => {
  // Verify the project belongs to the requesting user's company
  const proj = await query(
    `SELECT id FROM projects WHERE id = $1 AND company_id = $2`,
    [req.params.project_id, req.user.company_id]
  );
  if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' });

  const result = await query(
    `SELECT b.*,
       ROUND((b.quantity * b.rate)::numeric, 2) AS amount,
       COALESCE((SELECT SUM(net_quantity) FROM measurements WHERE boq_item_id=b.id AND status='pm_approved'),0) AS executed_qty,
       COALESCE((SELECT SUM(rbi.current_qty) FROM ra_bill_items rbi JOIN ra_bills rb ON rbi.ra_bill_id=rb.id
                  WHERE rbi.boq_item_id=b.id AND rb.status IN ('certified','paid')),0) AS certified_qty
     FROM boq_items b
     WHERE b.project_id=$1 AND b.is_active=true
     ORDER BY NULLIF(regexp_replace(b.chapter_no::text, '[^0-9]', '', 'g'), '')::int NULLS LAST,
              b.chapter_no, b.item_no`,
    [req.params.project_id]
  );
  res.json({ data: result.rows });
});

// POST IMPORT BOQ (Excel, CSV, PDF, Image)
router.post('/import', authorize('super_admin','admin','qs_engineer'), upload.single('file'), async (req, res) => {
  const { project_id } = req.body;
  
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!project_id) return res.status(400).json({ error: 'Project ID is required' });

  try {
    const items = await extractBOQItems(req.file.path, req.file.mimetype);

    if (!items || !items.length) {
      return res.status(400).json({
        error: 'No items were extracted from the document. Make sure your Excel has columns named Description, Quantity, Rate, and Unit. The first row with those words will be treated as the header row.'
      });
    }

    // All inserts in one transaction — either all succeed or none do
    const importedCount = await withTransaction(async (client) => {
      let count = 0;
      for (const item of items) {
        if (!item.description) continue;
        const remarks = `[AI-IMPORTED: VERIFY] ${item.remarks || ''}`.trim();
        await client.query(
          `INSERT INTO boq_items (project_id, chapter_no, chapter_name, item_no, sr_no, description, unit, quantity, rate, remarks, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [project_id, item.chapter_no || 'TBD', item.chapter_name || 'Imported',
           item.item_no || 'TBD', item.sr_no || null, item.description,
           item.unit || 'NOS', parseFloat(item.quantity) || 0, parseFloat(item.rate) || 0,
           remarks, req.user.id]
        );
        count++;
      }
      return count;
    });

    res.json({ success: true, count: importedCount, message: `Successfully imported ${importedCount} items as drafts.` });
  } catch (err) {
    console.error('[BOQ Import Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to process document import.' });
  }
});

module.exports = router;
