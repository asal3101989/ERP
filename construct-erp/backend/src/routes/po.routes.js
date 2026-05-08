// src/routes/po.routes.js
const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const { extractPO } = require('../services/poExtraction.service');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Public Verification Endpoint (No Auth required for QR scanning)
router.get('/public/verify/:id', async (req, res) => {
  try {
    const po = await query(
      `SELECT po.*, v.name as vendor_name, p.name as project_name, p.project_code,
              u.name AS created_by_name, u.signature_url AS created_by_sig,
              aud.name AS verified_audit_name, aud.signature_url AS verified_audit_sig,
              fin.name AS checked_finance_name, fin.signature_url AS checked_finance_sig,
              mgmt.name AS released_mgmt_name, mgmt.signature_url AS released_mgmt_sig,
              md.name AS authorized_md_name, md.signature_url AS authorized_md_sig
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       JOIN projects p ON po.project_id = p.id
       JOIN users u ON po.created_by = u.id
       LEFT JOIN users aud ON po.verified_procurement_by = aud.id
       LEFT JOIN users fin ON po.checked_finance_by = fin.id
       LEFT JOIN users mgmt ON po.released_mgmt_by = mgmt.id
       LEFT JOIN users md ON po.authorized_md_by = md.id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po.rows.length) return res.status(404).json({ error: 'Purchase Order not found' });
    
    const items = await query(
      `SELECT * FROM po_items WHERE po_id = $1 ORDER BY sort_order`,
      [req.params.id]
    );
    res.json({ data: { ...po.rows[0], items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate);

// GET /purchase-orders
router.get('/', async (req, res) => {
  try {
    const { project_id, status } = req.query;
    let sql = `SELECT po.*, v.name as vendor_name, p.name as project_name
               FROM purchase_orders po 
               JOIN vendors v ON po.vendor_id = v.id
               JOIN projects p ON po.project_id = p.id 
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let i = 2;
    if (project_id) { sql += ` AND po.project_id = $${i++}`; params.push(project_id); }
    if (status)     { sql += ` AND po.status = $${i++}`;     params.push(status); }
    sql += ' ORDER BY po.created_at DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /purchase-orders/:id
router.get('/:id', async (req, res) => {
  try {
    const po = await query(
      `SELECT po.*, v.name as vendor_name, p.name as project_name, p.project_code, p.company_id,
              u.name AS created_by_name, u.signature_url AS created_by_sig,
              aud.name AS verified_audit_name, aud.signature_url AS verified_audit_sig,
              fin.name AS checked_finance_name, fin.signature_url AS checked_finance_sig,
              mgmt.name AS released_mgmt_name, mgmt.signature_url AS released_mgmt_sig,
              md.name AS authorized_md_name, md.signature_url AS authorized_md_sig
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       JOIN projects p ON po.project_id = p.id
       JOIN users u ON po.created_by = u.id
       LEFT JOIN users aud ON po.verified_procurement_by = aud.id
       LEFT JOIN users fin ON po.checked_finance_by = fin.id
       LEFT JOIN users mgmt ON po.released_mgmt_by = mgmt.id
       LEFT JOIN users md ON po.authorized_md_by = md.id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po.rows.length || po.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }
    const items = await query(
      `SELECT * FROM po_items WHERE po_id = $1 ORDER BY sort_order`,
      [req.params.id]
    );
    res.json({ data: { ...po.rows[0], items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /purchase-orders (Multi-item)
router.post('/', async (req, res) => {
  try {
    const {
      project_id, vendor_id, po_date, delivery_date, status,
      terms_conditions, notes, bank_details, items, mrs_id
    } = req.body;

    if (!project_id || !vendor_id || !items?.length) {
      return res.status(400).json({ error: 'Missing required project, vendor or items.' });
    }

    const result = await withTransaction(async (client) => {
      // 1. Generate PO Number
      const yr = new Date().getFullYear().toString().slice(2);
      const nextYr = (parseInt(yr) + 1).toString();
      const countRes = await client.query('SELECT COUNT(*) FROM purchase_orders');
      const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
      const po_number = `PO/${yr}${nextYr}/${seq}`;

      // 2. Insert Header
      const headerRes = await client.query(
        `INSERT INTO purchase_orders (
          project_id, vendor_id, po_number, po_date, delivery_date,
          terms_conditions, notes, bank_details,
          status, created_by, mrs_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [project_id, vendor_id, po_number, po_date || null, delivery_date || null, terms_conditions || null, notes || null, bank_details || null, 'pending', req.user.id, mrs_id || null]
      );
      const poId = headerRes.rows[0].id;

      // 3. Insert Items & Calculate Totals
      let subTotal = 0;
      let totalGst = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const basic = parseFloat(item.quantity) * parseFloat(item.rate);
        const gst   = basic * (parseFloat(item.gst_rate || 0) / 100);
        
        await client.query(
          `INSERT INTO po_items (
            po_id, material_name, hsn_code, quantity, unit, rate, gst_rate, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [poId, item.material_name, item.hsn_code || null, item.quantity, item.unit, item.rate, item.gst_rate || 0, i + 1]
        );
        subTotal += basic;
        totalGst += gst;
      }

      // 4. Update Header with totals & formatted serial
      const projRes = await client.query('SELECT project_code FROM projects WHERE id = $1', [project_id]);
      const pCode = projRes.rows[0].project_code || 'PRJ';
      const serial_no_formatted = `BCIM-${pCode}-PO-${seq}`;

      const finalRes = await client.query(
        `UPDATE purchase_orders 
         SET sub_total = $1, total_gst = $2, grand_total = $3, serial_no_formatted = $4
         WHERE id = $5 RETURNING *`,
        [subTotal, totalGst, subTotal + totalGst, serial_no_formatted, poId]
      );

      return finalRes.rows[0];
    });

    res.status(201).json({ data: result });
  } catch (err) {
    console.error('PO Create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reject PO — must be before /:id/:stage to avoid being swallowed by the generic route
router.patch('/:id/reject', async (req, res) => {
  try {
    const po = await query(
      `SELECT po.*, p.company_id FROM purchase_orders po
       JOIN projects p ON po.project_id = p.id WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po.rows.length || po.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }
    await query(
      `UPDATE purchase_orders SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'PO rejected successfully', status: 'rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stage-based Approval
const PO_STAGES = {
  'verify-audit':  { nextStatus: 'verified_audit',  colBy: 'verified_procurement_by', colAt: 'verified_procurement_at', requiredPrev: 'pending'         },
  'check-finance': { nextStatus: 'checked_finance',  colBy: 'checked_finance_by',      colAt: 'checked_finance_at',      requiredPrev: 'verified_audit'  },
  'release-mgmt':  { nextStatus: 'released_mgmt',   colBy: 'released_mgmt_by',        colAt: 'released_mgmt_at',        requiredPrev: 'checked_finance' },
  'authorize-md':  { nextStatus: 'approved',         colBy: 'authorized_md_by',        colAt: 'authorized_md_at',        requiredPrev: 'released_mgmt'   },
};

router.patch('/:id/:stage', async (req, res) => {
  try {
    const { stage } = req.params;
    const cfg = PO_STAGES[stage];
    if (!cfg) return res.status(400).json({ error: 'Invalid approval stage' });

    const { signature_img } = req.body;

    const po = await query(
      `SELECT po.*, p.company_id FROM purchase_orders po
       JOIN projects p ON po.project_id = p.id WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po.rows.length || po.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }
    if (po.rows[0].status !== cfg.requiredPrev) {
      return res.status(400).json({ error: `Cannot perform ${stage}. Current status: ${po.rows[0].status}` });
    }

    // Merge signature into signatures JSONB
    let setSql = `status = $1, ${cfg.colBy} = $2, ${cfg.colAt} = NOW(), updated_at = NOW()`;
    const params = [cfg.nextStatus, req.user.id];

    if (signature_img) {
      const existing = po.rows[0].signatures || {};
      const updated  = {
        ...existing,
        [stage]: { img: signature_img, by: req.user.name || req.user.id, at: new Date().toISOString() },
      };
      setSql += `, signatures = $${params.length + 1}`;
      params.push(JSON.stringify(updated));
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE purchase_orders SET ${setSql} WHERE id = $${params.length} RETURNING status`,
      params
    );

    res.json({ message: `PO ${stage} successfully`, status: result.rows[0].status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /purchase-orders/import/preview — extract PO data from PDF, return for review
router.post('/import/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
    if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Only PDF files are supported' });
    const result = await extractPO(req.file.buffer);
    res.json(result);
  } catch (err) {
    console.error('[PO Import Preview]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to parse PDF' });
  }
});

// POST /purchase-orders/import/confirm — save reviewed PO data to DB
router.post('/import/confirm', async (req, res) => {
  try {
    const { project_id, vendor_id, header = {}, items = [] } = req.body;
    if (!project_id || !vendor_id) return res.status(400).json({ error: 'Project and Vendor are required' });

    const result = await withTransaction(async (client) => {
      // Auto-generate PO number if not extracted
      const seq = (await client.query(
        `SELECT COUNT(*) FROM purchase_orders po JOIN projects p ON po.project_id = p.id WHERE p.company_id = $1`,
        [req.user.company_id]
      )).rows[0].count;
      const yr = new Date().getFullYear().toString().slice(-2) + (new Date().getFullYear() + 1).toString().slice(-2);
      const po_number = header.po_number || `PO/${yr}/${String(Number(seq) + 1).padStart(3, '0')}`;

      // Calculate totals from items
      let sub_total = 0, total_gst = 0;
      const processedItems = (items || []).map((it, i) => {
        const qty   = parseFloat(it.quantity) || 0;
        const rate  = parseFloat(it.rate) || 0;
        const gst   = parseFloat(it.gst_rate) || 18;
        const base  = qty * rate;
        const gstAmt = base * gst / 100;
        sub_total  += base;
        total_gst  += gstAmt;
        return { ...it, quantity: qty, rate, gst_rate: gst, gst_amount: gstAmt, total_amount: base + gstAmt, sort_order: i + 1 };
      });
      const grand_total = sub_total + total_gst;

      const poRow = await client.query(
        `INSERT INTO purchase_orders
           (project_id, vendor_id, po_number, po_date, delivery_date,
            sub_total, total_gst, grand_total, terms_conditions, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11) RETURNING id, po_number`,
        [
          project_id, vendor_id, po_number,
          header.po_date || null, header.delivery_date || null,
          sub_total, total_gst, grand_total,
          header.terms_conditions || '', header.notes || '',
          req.user.id,
        ]
      );
      const po_id = poRow.rows[0].id;

      for (const it of processedItems) {
        await client.query(
          `INSERT INTO po_items (po_id, material_name, hsn_code, quantity, unit, rate, gst_rate, gst_amount, total_amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [po_id, it.material_name || 'Item', it.hsn_code || '', it.quantity, it.unit || 'Nos',
           it.rate, it.gst_rate, it.gst_amount, it.total_amount, it.sort_order]
        );
      }

      return poRow.rows[0];
    });

    res.json({ success: true, po_number: result.po_number, id: result.id });
  } catch (err) {
    console.error('[PO Import Confirm]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to save Purchase Order' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /purchase-orders/bulk-import
// Bulk-insert historical POs (one transaction per record for safety).
// Body: { project_id, records: [{ po_number, vendor_id, po_date, delivery_date,
//          grand_total, gst_pct, notes, status, subject }] }
// Returns: { created, skipped, errors: [{po_number, reason}] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/bulk-import', async (req, res) => {
  try {
    const { project_id, records = [] } = req.body;
    if (!project_id)        return res.status(400).json({ error: 'project_id is required' });
    if (!records.length)    return res.status(400).json({ error: 'No records provided' });

    let created = 0, skipped = 0;
    const errors  = [];
    const created_ids = []; // { po_number, id } — for PDF upload after import

    for (const rec of records) {
      try {
        if (!rec.po_number) { errors.push({ po_number: '?', reason: 'po_number missing' }); continue; }
        if (!rec.vendor_id) { errors.push({ po_number: rec.po_number, reason: 'vendor_id missing' }); continue; }

        // Check duplicate
        const dup = await query('SELECT id FROM purchase_orders WHERE po_number = $1', [rec.po_number]);
        if (dup.rows.length) { skipped++; continue; }

        const grandTotal = parseFloat(rec.grand_total) || 0;
        const gstPct     = parseFloat(rec.gst_pct) || 0;
        const subTotal   = gstPct > 0 ? grandTotal / (1 + gstPct / 100) : grandTotal;
        const totalGst   = grandTotal - subTotal;

        let newId;
        await withTransaction(async (client) => {
          const poRow = await client.query(
            `INSERT INTO purchase_orders
               (project_id, vendor_id, po_number, po_date, delivery_date,
                sub_total, total_gst, grand_total, notes, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [
              project_id, rec.vendor_id, rec.po_number,
              rec.po_date || null, rec.delivery_date || null,
              subTotal.toFixed(2), totalGst.toFixed(2), grandTotal.toFixed(2),
              rec.notes || '',
              rec.status || 'approved',
              req.user.id,
            ]
          );
          newId = poRow.rows[0].id;

          const matName = rec.subject || rec.notes || 'Imported Item';
          await client.query(
            `INSERT INTO po_items (po_id, material_name, quantity, unit, rate, gst_rate, gst_amount, total_amount, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)`,
            [newId, matName, 1, 'LS', subTotal.toFixed(2), gstPct, totalGst.toFixed(2), grandTotal.toFixed(2)]
          );
        });

        created++;
        created_ids.push({ po_number: rec.po_number, id: newId });
      } catch (e) {
        errors.push({ po_number: rec.po_number, reason: e.message });
      }
    }

    res.json({ created, skipped, errors, created_ids });
  } catch (err) {
    console.error('[PO Bulk Import]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
