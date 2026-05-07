// src/routes/subcontractor.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subcontractor.controller');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');

// ── Work Order PDF Parser ─────────────────────────────────────────────────────
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const WO_UNITS = ['day', 'hrs', 'hours', 'month', 'ls', 'nos', 'sqm', 'sqft', 'rmt', 'mt', 'kg', 'ltr', 'litre', 'point', 'cum', 'set'];

function parseNumW(s) { return parseFloat(String(s || '').replace(/[,\s₹]/g, '')) || 0; }
function parseDateW(s) {
  if (!s) return '';
  const p = s.split(/[\.\-\/]/);
  return p.length === 3 ? `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` : '';
}

function parseWOText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full  = lines.join(' ');
  const get   = (rx, def = '') => { const m = full.match(rx); return m ? m[1].trim() : def; };

  // ── Header ──
  const woNumber    = get(/Work\s*Order\s*No\s*[:\s]*([A-Z0-9\-]+)/i);
  const rawDate     = get(/Work\s*Order\s*Date\s*[:\s]*([\d]{1,2}[\.\-\/][\d]{1,2}[\.\-\/][\d]{4})/i);
  const woDate      = parseDateW(rawDate);
  const referenceNo = get(/Reference\s*No\s*[:\s]*([A-Z0-9\-]+)/i);
  const narration   = get(/Narration[:\s]*([^\n]+)/i);
  const paymentTerms = get(/Payment\s*[:]\s*([^\n]{5,100})/i, 'Against RA Bills - within 20 days');

  // ── Project name: look for "Project Name" label ──
  const projIdx = lines.findIndex(l => /Project\s*Name/i.test(l));
  let projectRaw = '';
  if (projIdx >= 0) {
    // May be on same line after the label, or next line
    const sameLine = lines[projIdx].replace(/Project\s*Name\s*/i, '').trim();
    projectRaw = sameLine || (lines[projIdx + 1] || '').trim();
  }
  if (!projectRaw) projectRaw = get(/Project\s*Name\s*[:\s]*([A-Z][^\n]{1,30})/i);

  // ── Contractor name ──
  let vendorName = '';
  // Look for "M/s. NAME" pattern - could be standalone line or after "Contractor"
  const mvsIdx = lines.findIndex(l => /^M\/s\./i.test(l));
  if (mvsIdx >= 0) {
    vendorName = lines[mvsIdx].replace(/^M\/s\.?\s*/i, '').trim();
  } else {
    // Try inline after "Contractor"
    const contrLine = lines.find(l => /Contractor\s+M\/s\./i.test(l));
    if (contrLine) {
      const cm = contrLine.match(/M\/s\.?\s*([A-Z][A-Z\s\.]+?)(?:\s{2,}|\d|$)/i);
      if (cm) vendorName = cm[1].trim();
    }
  }

  // ── Vendor PAN ──
  const panLine  = lines.find(l => /[A-Z]{5}[0-9]{4}[A-Z]/i.test(l) && !/GST/i.test(l));
  const vendorPAN = panLine ? (panLine.match(/([A-Z]{5}[0-9]{4}[A-Z])/)?.[1] || '') : '';

  // ── GST rate ──
  const gstStr  = get(/GST\s*@\s*([\d]+)\s*%/i, '18');
  const gstRate = parseInt(gstStr) || 18;

  // ── Line items: scan each line for a UOM keyword then grab numbers ──
  const items = [];
  const seen  = new Set();
  const uomRx = new RegExp(`\\b(${WO_UNITS.join('|')})\\b`, 'i');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const uomMatch = line.match(uomRx);
    if (!uomMatch) continue;

    const uom    = uomMatch[0];
    const uomPos = line.toLowerCase().indexOf(uom.toLowerCase());
    const after  = line.slice(uomPos + uom.length);

    // Pull numbers from this line + next 2 lines
    const numStr     = [after, lines[i+1] || '', lines[i+2] || ''].join(' ');
    const nums       = numStr.match(/[\d,]+\.?\d*/g) || [];
    const validNums  = nums.map(parseNumW).filter(n => n > 0);
    if (validNums.length < 2) continue;

    const qty  = validNums[0];
    const rate = validNums[1];
    if (qty < 0.01 || rate < 1) continue;

    const key = `${qty}-${rate}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Description: text before UOM on this line, strip leading sl number
    let desc = line.slice(0, uomPos).replace(/^\d+\s*/, '').trim();
    if (!desc) desc = (lines[i - 1] || '').replace(/^\d+\s*/, '').trim();
    if (!desc) desc = `Item ${items.length + 1}`;

    items.push({ description: desc, unit: uom, quantity: qty, rate, remarks: '' });
  }

  // ── Grand / Net total ──
  const grandTotal = parseNumW(get(/Net\s*Total\s*([\d,]+)/i, get(/TOTAL\s*([\d,]+)/i, '0')));

  return { woNumber, woDate, referenceNo, vendorName, vendorPAN, projectRaw, narration, paymentTerms, items, grandTotal, gstRate };
}

// POST /subcontractors/work-orders/parse-pdf  (must be BEFORE the :id catch-all)
router.post('/work-orders/parse-pdf', authenticate, memUpload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });
    const data   = await pdfParse(req.file.buffer);
    const parsed = parseWOText(data.text);
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse PDF: ' + err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

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

module.exports = router;
