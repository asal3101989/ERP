// src/routes/subcontractor.routes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/subcontractor.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const { extractWO } = require('../services/woExtraction.service');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// Dashboard
router.get('/dashboard', ctrl.getDashboard);

// Work Orders
router.get('/work-orders', ctrl.getWorkOrders);
router.post('/work-orders', authorize('super_admin', 'admin', 'project_manager'), ctrl.createWorkOrder);
router.get('/work-orders/:id', ctrl.getWorkOrder);
router.patch('/work-orders/:id', authorize('super_admin', 'admin', 'project_manager'), ctrl.updateWorkOrder);

// Measurements (MB)
router.get('/measurements', ctrl.getMeasurements);
router.post('/measurements', authorize('super_admin', 'admin', 'project_manager', 'site_engineer'), ctrl.createMeasurement);

// Billing
router.post('/bills', authorize('super_admin', 'admin', 'accountant'), ctrl.createBill);
router.get('/bills', ctrl.getBills);
router.get('/bills/:id', ctrl.getBill);
router.patch('/bills/:id', authorize('super_admin', 'admin', 'accountant'), ctrl.updateBill);

// POST /subcontractors/work-orders/import/preview
router.post('/work-orders/import/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
    if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Only PDF files are supported' });
    const result = await extractWO(req.file.buffer);
    res.json(result);
  } catch (err) {
    console.error('[WO Import Preview]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to parse PDF' });
  }
});

// POST /subcontractors/work-orders/import/confirm
router.post('/work-orders/import/confirm', async (req, res) => {
  try {
    const { project_id, vendor_id, header = {}, items = [] } = req.body;
    if (!project_id || !vendor_id) return res.status(400).json({ error: 'Project and Vendor are required' });

    const result = await withTransaction(async (client) => {
      const d = new Date();
      const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      const wo_number = header.wo_number || `WO-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Calculate total from items
      let total_value = parseFloat(header.total_value) || 0;
      const processedItems = (items || []).map(it => ({
        description: it.description || 'Item',
        unit: it.unit || 'LS',
        quantity: parseFloat(it.quantity) || 0,
        rate: parseFloat(it.rate) || 0,
        remarks: it.remarks || '',
      }));
      if (!total_value && processedItems.length) {
        total_value = processedItems.reduce((s, it) => s + it.quantity * it.rate, 0);
      }

      const woRow = await client.query(
        `INSERT INTO work_orders
           (project_id, vendor_id, wo_number, wo_date, subject, scope_of_work,
            start_date, end_date, total_value, terms_conditions, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11) RETURNING id, wo_number`,
        [
          project_id, vendor_id, wo_number,
          header.wo_date || new Date().toISOString().slice(0,10),
          header.subject || 'Imported Work Order',
          header.scope_of_work || '',
          header.start_date || null, header.end_date || null,
          total_value, header.terms_conditions || '',
          req.user.id,
        ]
      );
      const wo_id = woRow.rows[0].id;

      for (const it of processedItems) {
        await client.query(
          `INSERT INTO work_order_items (wo_id, description, unit, quantity, rate, remarks)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [wo_id, it.description, it.unit, it.quantity, it.rate, it.remarks]
        );
      }

      return woRow.rows[0];
    });

    res.json({ success: true, wo_number: result.wo_number, id: result.id });
  } catch (err) {
    console.error('[WO Import Confirm]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to save Work Order' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /subcontractors/work-orders/bulk-import
// Bulk-insert historical Work Orders.
// Body: { project_id, records: [{ wo_number, vendor_id, wo_date, start_date,
//          end_date, subject, total_value, status }] }
// Returns: { created, skipped, errors: [{wo_number, reason}] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/work-orders/bulk-import', async (req, res) => {
  try {
    const { project_id, records = [] } = req.body;
    if (!project_id)     return res.status(400).json({ error: 'project_id is required' });
    if (!records.length) return res.status(400).json({ error: 'No records provided' });

    let created = 0, skipped = 0;
    const errors = [];

    for (const rec of records) {
      try {
        if (!rec.wo_number) { errors.push({ wo_number: '?', reason: 'wo_number missing' }); continue; }
        if (!rec.vendor_id) { errors.push({ wo_number: rec.wo_number, reason: 'vendor_id missing' }); continue; }

        // Check duplicate
        const dup = await query('SELECT id FROM work_orders WHERE wo_number = $1', [rec.wo_number]);
        if (dup.rows.length) { skipped++; continue; }

        await query(
          `INSERT INTO work_orders
             (project_id, vendor_id, wo_number, wo_date, subject, scope_of_work,
              start_date, end_date, total_value, status, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            project_id, rec.vendor_id, rec.wo_number,
            rec.wo_date || null,
            rec.subject || rec.wo_number,
            rec.scope_of_work || '',
            rec.start_date || null,
            rec.end_date   || null,
            parseFloat(rec.total_value) || 0,
            rec.status || 'approved',
            req.user.id,
          ]
        );
        created++;
      } catch (e) {
        errors.push({ wo_number: rec.wo_number, reason: e.message });
      }
    }

    res.json({ created, skipped, errors });
  } catch (err) {
    console.error('[WO Bulk Import]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
