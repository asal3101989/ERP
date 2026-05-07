// src/routes/po.routes.js
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const multer = require('multer');
const { extractTextFromPDF } = require('../utils/pdf-ocr');
const router = express.Router();

// ── PDF Parse Helper ──────────────────────────────────────────────────────────
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const PO_UNITS = ['cum', 'mt', 'nos', 'kg', 'sqm', 'rmt', 'bags', 'ltr', 'litre', 'ls', 'sqft', 'point', 'month', 'day', 'hrs', 'set'];

function parseNum(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[,\s₹]/g, '')) || 0;
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


module.exports = router;
