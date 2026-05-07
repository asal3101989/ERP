// src/routes/po.routes.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const multer = require('multer');
const { extractTextFromPDF } = require('../utils/pdf-ocr');
const router = express.Router();

// ── Auto-migrate: fix purchase_orders status check constraint ────────────────
(async () => {
  try {
    await query(`ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check`);
    await query(`
      ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
      CHECK (status IN (
        'draft','pending','verified_audit','verified_procurement',
        'checked_finance','released_mgmt','approved','sent',
        'part_received','fully_received','cancelled','rejected'
      ))
    `);
    console.log('[PO] Status constraint migrated OK');
  } catch (e) {
    console.error('[PO] Status constraint migration error:', e.message);
  }
})();

// ── PDF Parse Helper ──────────────────────────────────────────────────────────
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PO_UNITS = ['cum', 'mt', 'nos', 'kg', 'sqm', 'rmt', 'bags', 'ltr', 'litre', 'ls', 'sqft', 'point', 'month', 'day', 'hrs', 'set'];

function parseNum(s) {
  if (!s) return 0;
  const str = String(s).replace(/[₹\s]/g, '');
  // Indian format: 1,00,000 or 1,000 — commas are thousand separators
  // OCR sometimes misreads commas as dots or merges digits oddly
  // Remove all commas first, then parse
  return parseFloat(str.replace(/,/g, '')) || 0;
}

// Fix OCR number artifacts: OCR can merge two numbers "300.004,050.00" → split them
// or misread comma as period. We look for "quantity rate" pattern in token list.
function cleanOCRNums(str) {
  // Replace any sequence of digits that look merged e.g. "300.004050" → try to split at decimal
  return str.replace(/(\d{1,4})\.(\d{3,})(\d{3})/g, '$1,$2.$3');
}

function parseDate(s) {
  if (!s) return '';
  const parts = s.split(/[\.\-\/]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return '';
}

function parsePOText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full  = lines.join(' ');
  const get   = (rx, def = '') => { const m = full.match(rx); return m ? m[1].trim() : def; };

  // ── Header ──
  const poNumber   = get(/PO No[:\s]*([A-Z0-9\-]+)/i);
  const rawDate    = get(/Date[:\s]*([\d]{1,2}[\.\-\/][\d]{1,2}[\.\-\/][\d]{4})/i);
  const poDate     = parseDate(rawDate);
  const projectRaw = get(/Project[:\s]*([A-Z][^\n]{1,40}?)(?:\s{2,}|PO No|Date)/i);
  const narration  = get(/Narration[:\s]*([^\n]+)/i);
  const paymentTerms = get(/Payment\s*[:]\s*([^\n]{5,80})/i, '30 days from date of supply');

  // ── Vendor: look for "To," then next non-empty line ──
  let vendorName = '';
  let vendorGST  = '';
  const toIdx = lines.findIndex(l => /^To,?$/i.test(l));
  if (toIdx >= 0) {
    vendorName = (lines[toIdx + 1] || '').replace(/^M\/s\.?\s*/i, '').trim();
    const gstLine = lines.slice(toIdx, toIdx + 12).find(l => /GST\s*[:\s]*[0-9A-Z]{15}/i.test(l));
    if (gstLine) { const gm = gstLine.match(/([0-9A-Z]{15})/); if (gm) vendorGST = gm[1]; }
  }
  if (!vendorName) {
    // fallback: look for M/s. anywhere
    const mvsLine = lines.find(l => /^M\/s\./i.test(l));
    if (mvsLine) vendorName = mvsLine.replace(/^M\/s\.?\s*/i, '').trim();
  }

  // ── GST rate ──
  const cgstM = full.match(/CGST\s*@\s*([\d]+)\s*%/i);
  const gstRate = cgstM ? String(parseInt(cgstM[1]) * 2) : '18';

  // ── Line items: scan line-by-line for UOM keyword + numbers ──
  // pdf-parse may put each column on its own line, so we merge nearby lines.
  const items = [];
  const seen  = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find a UOM in this line
    const uomMatch = line.match(new RegExp(`\\b(${PO_UNITS.join('|')})\\b`, 'i'));
    if (!uomMatch) continue;

    const uom     = uomMatch[0];
    const uomPos  = line.toLowerCase().indexOf(uom.toLowerCase());
    const afterUOM = line.slice(uomPos + uom.length);

    // Extract numbers after UOM (in this line and next 2 lines)
    const numStr = [afterUOM, lines[i+1] || '', lines[i+2] || ''].join(' ');
    const nums   = numStr.match(/[\d,]+\.?\d*/g) || [];
    const validNums = nums.map(n => parseNum(n)).filter(n => n > 0);
    if (validNums.length < 2) continue;

    const qty  = validNums[0];
    const rate = validNums[1];

    // Skip if rate is unrealistically small (e.g., a percentage like 9)
    if (rate < 1) continue;
    // Skip duplicate item (same qty+rate)
    const key = `${qty}-${rate}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Description: everything before the UOM on this line, or previous line
    let desc = line.slice(0, uomPos).trim();
    // Remove leading sl number
    desc = desc.replace(/^\d+\s*/, '').trim();
    // If description is empty or just mix-design, look at previous line
    if (!desc || /^\d+\s*kgs/i.test(desc)) {
      desc = (lines[i - 1] || '').replace(/^\d+\s*/, '').trim();
    }
    // Append mix design if it's in a sub-line pattern
    const mixLine = (lines[i - 1] || '');
    if (/kgs\s*(cement|ggbs|fly\s*ash)/i.test(mixLine) && !desc.toLowerCase().includes('kgs')) {
      desc = `${desc} (${mixLine.trim()})`;
    }
    if (!desc) desc = `Item ${items.length + 1}`;

    items.push({ material_name: desc, unit: uom, quantity: qty, rate, gst_rate: gstRate, hsn_code: '' });
  }

  // ── Grand total ──
  const grandTotal = parseNum(get(/Grand Total\s*([\d,]+)/i, get(/Net\s*Total\s*([\d,]+)/i, '0')));

  return { poNumber, poDate, vendorName, vendorGST, projectRaw, narration, paymentTerms, items, grandTotal };
}

// POST /purchase-orders/parse-pdf
router.post('/parse-pdf', authenticate, memUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
    const { text, method } = await extractTextFromPDF(req.file.buffer);
    const parsed = parsePOText(text);
    parsed._method = method; // 'text' or 'ocr'
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

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
      project_id, vendor_id, po_date, delivery_date,
      po_ref_no, po_req_no, approval_no, delivery_address,
      narration, terms_conditions, notes, bank_details,
      cgst_rate, sgst_rate, igst_rate, gst_inclusive,
      items
    } = req.body;

    if (!project_id || !vendor_id || !items?.length) {
      return res.status(400).json({ error: 'Missing required project, vendor or items.' });
    }

    const result = await withTransaction(async (client) => {
      // 1. Generate PO Number — Financial Year format: BCIM/PO/25-26/001
      const now = new Date();
      // Financial year: April start. If month < 4 (Jan-Mar), FY is prev-curr
      const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyEnd   = fyStart + 1;
      const fyLabel = `${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}`; // e.g. "25-26"
      const countRes = await client.query('SELECT COUNT(*) FROM purchase_orders');
      const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
      const po_number = `BCIM/PO/${fyLabel}/${seq}`;

      // 2. Insert Header
      const headerRes = await client.query(
        `INSERT INTO purchase_orders (
          project_id, vendor_id, po_number, po_date, delivery_date,
          po_ref_no, po_req_no, approval_no, delivery_address,
          narration, terms_conditions, notes, bank_details,
          cgst_rate, sgst_rate, igst_rate, gst_inclusive,
          status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [
          project_id, vendor_id, po_number, po_date || null, delivery_date || null,
          po_ref_no || null, po_req_no || null, approval_no || null, delivery_address || null,
          narration || null, terms_conditions || null, notes || null, bank_details || null,
          parseFloat(cgst_rate) || 9, parseFloat(sgst_rate) || 9, parseFloat(igst_rate) || 0,
          gst_inclusive === true || gst_inclusive === 'true',
          'draft', req.user.id
        ]
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
            po_id, material_name, mix_design, hsn_code,
            quantity, unit, rate, gst_rate, req_date, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            poId, item.material_name, item.mix_design || null, item.hsn_code || null,
            item.quantity, item.unit, item.rate, item.gst_rate || 0,
            item.req_date || null, i + 1
          ]
        );
        subTotal += basic;
        totalGst += gst;
      }

      // 4. Update Header with totals & formatted serial
      // Use user-supplied display number if provided, else use the auto-generated po_number
      const serial_no_formatted = (req.body.po_number_display && req.body.po_number_display.trim())
        ? req.body.po_number_display.trim()
        : po_number;
      const grandTotal = gst_inclusive ? subTotal : subTotal + totalGst;

      const finalRes = await client.query(
        `UPDATE purchase_orders
         SET sub_total = $1, total_gst = $2, grand_total = $3, serial_no_formatted = $4
         WHERE id = $5 RETURNING *`,
        [subTotal, totalGst, grandTotal, serial_no_formatted, poId]
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

// GET /purchase-orders/:id/bills — all DQS bills linked to this PO
// NOTE: declared before /:id/:stage to avoid wildcard clash
router.get('/:id/bills', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        b.id,
        b.sl_number,
        b.inv_number,
        b.inv_date,
        b.vendor_name,
        b.basic_amount,
        b.gst_amount,
        b.total_amount,
        b.workflow_status,
        COALESCE(u.certified_net,  0)  AS certified_net,
        COALESCE(u.paid_amount,    0)  AS paid_amount,
        COALESCE(u.balance_to_pay, 0)  AS balance_to_pay,
        u.payment_status
      FROM dqs_bills b
      LEFT JOIN dqs_bill_updates u ON u.bill_id = b.id
      WHERE b.po_id = $1
        AND b.is_deleted = FALSE
      ORDER BY b.inv_date ASC NULLS LAST
    `, [req.params.id]);

    const summary = rows.reduce((s, r) => ({
      total_invoiced:  s.total_invoiced  + parseFloat(r.total_amount  || 0),
      total_certified: s.total_certified + parseFloat(r.certified_net || 0),
      total_paid:      s.total_paid      + parseFloat(r.paid_amount   || 0),
      outstanding:     s.outstanding     + parseFloat(r.balance_to_pay|| 0),
    }), { total_invoiced: 0, total_certified: 0, total_paid: 0, outstanding: 0 });

    res.json({ data: rows, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /purchase-orders/:id/renumber — update PO display number
// NOTE: declared before /:id/:stage to avoid wildcard clash
router.patch('/:id/renumber', async (req, res) => {
  try {
    const { po_number_display } = req.body;
    if (!po_number_display?.trim()) {
      return res.status(400).json({ error: 'PO number cannot be empty' });
    }
    // Check ownership
    const existing = await query(
      `SELECT po.id, p.company_id FROM purchase_orders po
       JOIN projects p ON po.project_id = p.id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!existing.rows.length || existing.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'PO not found' });
    }
    // Check duplicate
    const dup = await query(
      `SELECT id FROM purchase_orders WHERE serial_no_formatted = $1 AND id != $2`,
      [po_number_display.trim(), req.params.id]
    );
    if (dup.rows.length) {
      return res.status(400).json({ error: 'This PO number is already used by another PO' });
    }
    const result = await query(
      `UPDATE purchase_orders SET serial_no_formatted = $1 WHERE id = $2 RETURNING *`,
      [po_number_display.trim(), req.params.id]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stage-based Approval  (3 stages: Audit → Director → MD)
const PO_STAGES = {
  'verify-audit': { nextStatus: 'verified_audit', colBy: 'verified_procurement_by', colAt: 'verified_procurement_at', requiredPrev: 'draft',          allowedRoles: ['super_admin','admin','project_manager','site_engineer'] },
  'release-mgmt': { nextStatus: 'released_mgmt',  colBy: 'released_mgmt_by',        colAt: 'released_mgmt_at',        requiredPrev: 'verified_audit', allowedRoles: ['super_admin','admin','project_manager'] },
  'authorize-md': { nextStatus: 'approved',        colBy: 'authorized_md_by',        colAt: 'authorized_md_at',        requiredPrev: 'released_mgmt',  allowedRoles: ['super_admin','managing_director'] },
};

router.patch('/:id/:stage', async (req, res) => {
  try {
    const { stage } = req.params;
    const cfg = PO_STAGES[stage];
    if (!cfg) return res.status(400).json({ error: 'Invalid approval stage' });

    if (!cfg.allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Only ${cfg.allowedRoles.join(' / ')} can perform this action` });
    }

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


module.exports = router;
