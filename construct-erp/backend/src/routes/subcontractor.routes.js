// src/routes/subcontractor.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subcontractor.controller');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');

// ── Work Order PDF Parser ─────────────────────────────────────────────────────
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function parseWOText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full  = lines.join(' ');

  const get = (regex, def = '') => { const m = full.match(regex); return m ? m[1].trim() : def; };

  // Header fields
  const woNumber    = get(/Work\s*Order\s*No\s*[:\s]+([A-Z0-9\-]+)/i);
  const rawDate     = get(/Work\s*Order\s*Date\s*[:\s]+([\d]{2}[\.\-\/][\d]{2}[\.\-\/][\d]{4})/i);
  const referenceNo = get(/Reference\s*No\s*[:\s]+([A-Z0-9\-]+)/i);
  const projectRaw  = get(/Project\s*Name\s*[:\s]+([A-Z][^\n]{1,30}?)(?:\s{2,}|Place|$)/i);
  const narration   = get(/Narration[:\s]+([^\n]+)/i);
  const paymentTerms = get(/Payment\s*[:\s]+([^\n]{5,100})/i, 'Against RA Bills - within 20 days');

  // Parse date DD.MM.YYYY → YYYY-MM-DD
  let woDate = '';
  if (rawDate) {
    const [d, m, y] = rawDate.split(/[\.\-\/]/);
    woDate = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Contractor name — find line starting with M/s.
  let vendorName = '';
  const mvsLine = lines.find(l => /^M\/s\./i.test(l));
  if (mvsLine) {
    vendorName = mvsLine.replace(/^M\/s\.?\s*/i, '').trim();
  } else {
    const m2 = full.match(/Contractor\s+M\/s\.\s*([A-Z][A-Z\s\.]+?)(?:\s{3,}|\d{5}|West|Nardash)/i);
    if (m2) vendorName = m2[1].trim();
  }

  // Vendor PAN
  const panLine = lines.find(l => /PAN\s*No\s*[:\s]+[A-Z]{5}[0-9]{4}[A-Z]/i.test(l));
  const vendorPAN = panLine ? (panLine.match(/([A-Z]{5}[0-9]{4}[A-Z])/)?.[1] || '') : '';

  // Line items — match: number, long description, UOM, qty, rate, amount
  const items = [];
  const unitPat = '(?:Day|Hrs|Hours|Month|LS|Nos|SQM|SQFT|RMT|MT|KG|Ltr|Litre|Point)';
  const itemRx  = new RegExp(
    `(\\d+)\\s+([A-Za-z][^\\d]{8,100}?)\\s+(${unitPat})\\.?\\s+([\\d,]+\\.?\\d*)\\s+([\\d,]+\\.?\\d*)\\s+([\\d,]+\\.?\\d*)`,
    'gi'
  );
  let m;
  while ((m = itemRx.exec(full)) !== null) {
    const qty  = parseFloat(m[4].replace(/,/g, ''));
    const rate = parseFloat(m[5].replace(/,/g, ''));
    if (!qty || !rate) continue;
    items.push({
      description: m[2].trim(),
      unit:        m[3],
      quantity:    qty,
      rate:        rate,
      remarks:     '',
    });
  }

  // Grand / Net total
  const grandTotal = parseFloat(
    get(/Net\s*Total\s+([\d,]+)/i, get(/TOTAL\s+([\d,]+)/i, '0')).replace(/,/g, '')
  ) || 0;

  // GST rate
  const gstStr  = get(/GST\s*@\s*([\d]+)%/i, '18');
  const gstRate = parseInt(gstStr) || 18;

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
