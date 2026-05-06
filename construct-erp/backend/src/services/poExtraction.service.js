// PDF extraction service for Purchase Orders
const pdfParse = require('pdf-parse');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const UNIT_RE = /\b(MT|Bags?|CUM|Cu\.?\s?M|SQM|SQFT|SFT|Nos?\.?|PCS|PC|Each|EA|RMT|RM|KG|Kgs?|Litre|Ltrs?|LS|Lot|Month|Set|Pairs?|Ton|Tonne|KN|M3|M2)\b/i;
const UNIT_NORMALIZE = {
  BAG: 'BAGS',
  BAGS: 'BAGS',
  'CU M': 'CUM',
  'CU.M': 'CUM',
  CUM: 'CUM',
  EA: 'NOS',
  EACH: 'NOS',
  M2: 'SQM',
  M3: 'CUM',
  NOS: 'NOS',
  'NOS.': 'NOS',
  PC: 'NOS',
  PCS: 'NOS',
  RM: 'RMT',
  SFT: 'SQFT',
};

function clean(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function parseDate(str) {
  if (!str) return null;
  const s = str.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // DD Mon YYYY  e.g. 12 Jan 2025
  const m2 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m2) {
    const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const mo = months[m2[2].toLowerCase().slice(0,3)];
    if (mo) return `${m2[3]}-${String(mo).padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  }
  return null;
}

function parseAmount(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/,/g, '').replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function normalizeUnit(unit) {
  const key = clean(unit).replace(/\s+/g, ' ').toUpperCase();
  return UNIT_NORMALIZE[key] || key;
}

function stripItemNoise(str) {
  return clean(str)
    .replace(/^(?:sl|sr|s\.?no\.?|no\.?)\s*/i, '')
    .replace(/^\d+[.):\-\s]+/, '')
    .replace(/\bhsn\s*(?:code)?\s*[:\-]?\s*\d{4,8}\b/ig, '')
    .trim();
}

function extractHeader(text) {
  const header = {
    po_number: '',
    vendor_name: '',
    po_date: null,
    delivery_date: null,
    grand_total: 0,
    notes: '',
    terms_conditions: '',
  };

  const patterns = [
    { key: 'po_number',      re: /(?:P\.?O\.?\s*(?:No|Number|#|Ref)[:\s.]*)([\w\/\-]+)/i },
    { key: 'po_number',      re: /(?:Purchase\s+Order\s*(?:No|Number|#)?[:\s.]*)([\w\/\-]+)/i },
    { key: 'vendor_name',    re: /(?:^To[:\s]+|Vendor\s*(?:Name)?[:\s]+|Supplier[:\s]+|M\/s\.?\s+)(.+)/im },
    { key: 'po_date',        re: /(?:(?:PO\s*)?Date|Dated)[:\s]+([\d]{1,2}[\/-][\d]{1,2}[\/-][\d]{4}|[\d]{1,2}\s+\w+\s+\d{4})/i },
    { key: 'delivery_date',  re: /(?:Delivery\s*(?:Date)?|Required\s*By|Due\s*Date)[:\s]+([\d]{1,2}[\/-][\d]{1,2}[\/-][\d]{4}|[\d]{1,2}\s+\w+\s+\d{4})/i },
    { key: 'grand_total',    re: /(?:Grand\s*Total|Total\s*Amount|Net\s*(?:Amount|Value)|Total\s*Value)[:\s₹]*([\d,]+\.?\d*)/i },
  ];

  for (const { key, re } of patterns) {
    if (header[key]) continue; // first match wins
    const m = text.match(re);
    if (!m) continue;
    if (key === 'po_date' || key === 'delivery_date') {
      header[key] = parseDate(m[1]);
    } else if (key === 'grand_total') {
      header[key] = parseAmount(m[1]);
    } else {
      header[key] = clean(m[1]);
    }
  }

  // Extract notes / remarks block
  const notesM = text.match(/(?:Notes?|Remarks?)[:\s]+([^\n]{3,})/i);
  if (notesM) header.notes = clean(notesM[1]);

  // Extract terms block (take a few lines after "Terms")
  const termsIdx = text.search(/Terms?\s*(?:&|and)?\s*Conditions?/i);
  if (termsIdx !== -1) {
    header.terms_conditions = clean(text.slice(termsIdx, termsIdx + 400));
  }

  return header;
}

function extractItems(lines) {
  const items = [];

  for (const line of lines) {
    const unitMatch = line.match(UNIT_RE);
    if (!unitMatch) continue;

    const unitIdx = line.indexOf(unitMatch[0]);
    const before = line.slice(0, unitIdx).trim();
    const after = line.slice(unitIdx + unitMatch[0].length).trim();

    const desc = stripItemNoise(before);
    if (!desc || desc.length < 3) continue;

    // Extract numbers from the "after" portion
    const nums = [...after.matchAll(/[\d,]+\.?\d*/g)]
      .map(m => parseFloat(m[0].replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);

    const quantity = nums[0] || 0;
    const rate     = nums[1] || 0;
    const gst_rate = nums[2] && nums[2] <= 28 ? nums[2] : 18;

    // Try to find HSN code: 4–8 digit number early in the line
    const hsnMatch = line.match(/\b(\d{4,8})\b/);
    const hsn_code = hsnMatch ? hsnMatch[1] : '';

    items.push({
      material_name: desc,
      unit: normalizeUnit(unitMatch[0]),
      quantity,
      rate,
      gst_rate,
      hsn_code,
    });
  }

  return items;
}

function extractItemsFromText(text) {
  const normalized = clean(text.replace(/\n/g, ' '));
  const items = [];
  const rowRe = /(?:^|\s)(?:\d{1,3}[.)]?\s+)([A-Za-z][A-Za-z0-9\s.,/&()\-]{4,180}?)\s+(MT|Bags?|CUM|Cu\.?\s?M|SQM|SQFT|SFT|Nos?\.?|PCS|PC|Each|EA|RMT|RM|KG|Kgs?|Litre|Ltrs?|LS|Lot|Month|Set|Pairs?|Ton|Tonne|KN|M3|M2)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)(?:\s+(\d{1,2}(?:\.\d+)?))?/gi;

  for (const match of normalized.matchAll(rowRe)) {
    const material_name = stripItemNoise(match[1]);
    if (!material_name || /^(material|description|item|particulars)\b/i.test(material_name)) continue;

    const quantity = parseAmount(match[3]);
    const rate = parseAmount(match[4]);
    if (!quantity || !rate) continue;

    const hsnMatch = material_name.match(/\b(\d{4,8})\b/);
    items.push({
      material_name,
      unit: normalizeUnit(match[2]),
      quantity,
      rate,
      gst_rate: match[5] && Number(match[5]) <= 28 ? Number(match[5]) : 18,
      hsn_code: hsnMatch ? hsnMatch[1] : '',
    });
  }

  return items;
}

async function extractTextWithOcr(buffer) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'po-ocr-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  const imagePrefix = path.join(tmpDir, 'page');

  try {
    await fs.writeFile(pdfPath, buffer);

    await execFileAsync('pdftoppm', ['-png', '-r', '220', '-f', '1', '-l', '3', pdfPath, imagePrefix], {
      timeout: 45000,
      windowsHide: true,
    });

    const files = (await fs.readdir(tmpDir))
      .filter(file => /^page-\d+\.png$/i.test(file))
      .sort();

    const pages = [];
    for (const file of files) {
      const imagePath = path.join(tmpDir, file);
      const { stdout } = await execFileAsync('tesseract', [imagePath, 'stdout', '-l', 'eng', '--psm', '6'], {
        timeout: 45000,
        windowsHide: true,
      });
      if (stdout) pages.push(stdout);
    }

    return pages.join('\n');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function extractPO(buffer) {
  const data = await pdfParse(buffer);
  let text = data.text || '';
  const warnings = [];

  if (clean(text).length < 80) {
    try {
      const ocrText = await extractTextWithOcr(buffer);
      if (clean(ocrText).length > clean(text).length) {
        text = ocrText;
        warnings.push('OCR was used because this PDF is scanned/image-based. Please review the extracted data carefully.');
      }
    } catch (err) {
      warnings.push(
        'This PDF is scanned/image-based. Install OCR tools on the server with: sudo apt install poppler-utils tesseract-ocr'
      );
    }
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const header = extractHeader(text);
  let items = extractItems(lines);
  if (!items.length) items = extractItemsFromText(text);

  if (clean(text).length < 80) {
    warnings.push('This PDF appears to be scanned or image-based, so text extraction is limited.');
  }
  if (!items.length) {
    warnings.push('No PO line items were detected automatically. Please add them manually or upload a text-based PO PDF.');
  }

  return { header, items, warnings, rawText: text.slice(0, 2000) };
}

module.exports = { extractPO };
