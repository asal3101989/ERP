// PDF extraction service for Work Orders
const pdfParse = require('pdf-parse');

const UNIT_RE = /\b(SQFT|SQM|RMT|Nos?|MT|Kg|Point|Month|LS|Day|CUM|RMT|KG|Litre|Set)\b/i;

function clean(str) {
  return (str || '').replace(/\s+/g, ' ').trim();
}

function parseDate(str) {
  if (!str) return null;
  const s = str.trim();
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
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
  return parseFloat(str.replace(/[,\s₹]/g, '')) || 0;
}

function extractHeader(text) {
  const header = {
    wo_number: '',
    vendor_name: '',
    subject: '',
    wo_date: null,
    start_date: null,
    end_date: null,
    total_value: 0,
    terms_conditions: '',
    scope_of_work: '',
  };

  const patterns = [
    { key: 'wo_number',   re: /(?:W\.?O\.?\s*(?:No|Number|#|Ref)[:\s.]*)([\w\/\-]+)/i },
    { key: 'wo_number',   re: /(?:Work\s+Order\s*(?:No|Number|#)?[:\s.]*)([\w\/\-]+)/i },
    { key: 'vendor_name', re: /(?:^To[:\s]+|Contractor[:\s]+|Sub[\-\s]?[Cc]ontractor[:\s]+|M\/s\.?\s+)(.+)/im },
    { key: 'subject',     re: /(?:Subject|Re|Work\s+Order\s*(?:for)?)[:\s]+([^\n]{5,})/i },
    { key: 'wo_date',     re: /(?:(?:WO\s*)?Date|Dated)[:\s]+([\d]{1,2}[\/-][\d]{1,2}[\/-][\d]{4}|[\d]{1,2}\s+\w+\s+\d{4})/i },
    { key: 'start_date',  re: /(?:Start\s*Date|Commencement)[:\s]+([\d]{1,2}[\/-][\d]{1,2}[\/-][\d]{4}|[\d]{1,2}\s+\w+\s+\d{4})/i },
    { key: 'end_date',    re: /(?:End\s*Date|Completion|Finish)[:\s]+([\d]{1,2}[\/-][\d]{1,2}[\/-][\d]{4}|[\d]{1,2}\s+\w+\s+\d{4})/i },
    { key: 'total_value', re: /(?:Contract\s*(?:Amount|Value)|Total\s*(?:Amount|Value)|Grand\s*Total)[:\s₹]*([\d,]+\.?\d*)/i },
  ];

  for (const { key, re } of patterns) {
    if (header[key]) continue;
    const m = text.match(re);
    if (!m) continue;
    if (key === 'wo_date' || key === 'start_date' || key === 'end_date') {
      header[key] = parseDate(m[1]);
    } else if (key === 'total_value') {
      header[key] = parseAmount(m[1]);
    } else {
      header[key] = clean(m[1]);
    }
  }

  // Extract scope of work block
  const scopeIdx = text.search(/Scope\s+of\s+Work/i);
  if (scopeIdx !== -1) {
    header.scope_of_work = clean(text.slice(scopeIdx, scopeIdx + 600));
  }

  // Extract terms
  const termsIdx = text.search(/Terms?\s*(?:&|and)?\s*Conditions?/i);
  if (termsIdx !== -1) {
    header.terms_conditions = clean(text.slice(termsIdx, termsIdx + 500));
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
    const after  = line.slice(unitIdx + unitMatch[0].length).trim();

    const desc = before.replace(/^\d+[.):\s]+/, '').trim();
    if (!desc || desc.length < 3) continue;

    const nums = [...after.matchAll(/[\d,]+\.?\d*/g)]
      .map(m => parseFloat(m[0].replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);

    const quantity = nums[0] || 0;
    const rate     = nums[1] || 0;

    items.push({
      description: desc,
      unit: unitMatch[0].toUpperCase(),
      quantity,
      rate,
      remarks: '',
    });
  }

  return items;
}

async function extractWO(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text || '';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const header = extractHeader(text);
  const items  = extractItems(lines);

  return { header, items, rawText: text.slice(0, 2000) };
}

module.exports = { extractWO };
