const fs = require('fs');
const path = require('path');

/**
 * Extracts BOQ items from PDF, Excel, CSV, or Image
 * PDF  -> pdf-parse text extraction + table heuristics
 * Excel -> xlsx library (no API key needed)
 * CSV  -> direct column parsing
 * Image -> requires local Ollama (AI fallback)
 */
async function extractBOQItems(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  const isExcel = ext === '.xlsx' || ext === '.xls'
    || mime.includes('spreadsheet') || mime.includes('excel')
    || mime.includes('openxmlformats') || mime === 'application/vnd.ms-excel';

  const isCSV = ext === '.csv' || mime.includes('csv') || mime === 'text/csv';
  const isPDF = ext === '.pdf' || mime.includes('pdf');
  const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) || mime.includes('image');

  if (isExcel) return parseExcel(filePath);
  if (isCSV) return parseCSV(filePath);
  if (isPDF) return parsePDF(filePath);
  if (isImage) return runAIExtraction(filePath, mimeType);

  try {
    const result = parseExcel(filePath);
    if (result.length) return result;
  } catch (_) {}

  throw new Error(`Unsupported file type: "${ext || mime}". Please upload Excel (.xlsx/.xls), CSV, or PDF.`);
}

function parseExcel(filePath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const items = parseSheet(sheet, XLSX);
    if (items.length > 0) return items;
  }
  return [];
}

function parseSheet(sheet, XLSX) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) return [];

  const normalize = (value) => String(value).toLowerCase().replace(/[\s_.\-\/()#]/g, '');

  const DESC_KW = ['description', 'desc', 'particular', 'item', 'work', 'details', 'specification', 'spec'];
  const QTY_KW = ['quantity', 'qty', 'qnty'];
  const RATE_KW = ['rate', 'unitrate', 'price', 'unitprice'];
  const UNIT_KW = ['unit', 'uom'];

  const hasKeyword = (cell, list) => list.some((keyword) => normalize(cell).includes(keyword));

  let headerRowIdx = -1;
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex++) {
    const row = rows[rowIndex];
    const hasDesc = row.some((cell) => hasKeyword(cell, DESC_KW));
    const hasQty = row.some((cell) => hasKeyword(cell, QTY_KW));
    const hasRate = row.some((cell) => hasKeyword(cell, RATE_KW));
    if (hasDesc && (hasQty || hasRate)) {
      headerRowIdx = rowIndex;
      break;
    }
  }

  if (headerRowIdx === -1) {
    let maxCells = 0;
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex++) {
      const nonEmpty = rows[rowIndex].filter((cell) => String(cell).trim() !== '').length;
      if (nonEmpty > maxCells) {
        maxCells = nonEmpty;
        headerRowIdx = rowIndex;
      }
    }
  }

  if (headerRowIdx === -1) return [];

  const headers = rows[headerRowIdx].map((header) => String(header));
  const columnIndex = (keywords) => headers.findIndex((header) => hasKeyword(header, keywords));

  const iDesc = columnIndex(DESC_KW);
  const iQty = columnIndex(QTY_KW);
  const iRate = columnIndex(RATE_KW);
  const iUnit = columnIndex(UNIT_KW);
  const iCsi = columnIndex(['csicode', 'csi code', 'csino', 'csi no', 'csi#', 'csi']);
  const iSrNo = iCsi >= 0 ? iCsi : columnIndex(['srno', 'sr no', 'slno', 'sl no', 'sno', 's.no', 's.n', 'serialno']);
  const iItemNo = columnIndex(['itemno', 'item no', 'item#', 'itno', 'no.', 'itemcode']);
  const iChNo = columnIndex(['chapterno', 'chno', 'chapternum', 'chapno', 'chap no']);
  const iChName = columnIndex(['chaptername', 'chapter name', 'chapter', 'section', 'heading']);
  const iAmt = columnIndex(['amount', 'amt', 'total', 'value']);
  const iRemarks = columnIndex(['remarks', 'remark', 'note', 'notes', 'comment']);

  if (iDesc === -1) return [];

  const getCell = (row, index) => (index >= 0 && index < row.length ? String(row[index] ?? '').trim() : '');
  const toNumber = (value) => parseFloat(String(value).replace(/,/g, '')) || 0;

  const items = [];
  let currentChapter = '';
  let currentChapterNo = '';
  let chapterCounter = 0;

  for (let rowIndex = headerRowIdx + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (row.every((cell) => String(cell).trim() === '')) continue;

    const desc = getCell(row, iDesc);
    const qty = toNumber(getCell(row, iQty));
    const rate = toNumber(getCell(row, iRate));
    const unit = getCell(row, iUnit);
    const amount = iAmt >= 0 ? toNumber(getCell(row, iAmt)) : 0;

    if (iChName >= 0 && getCell(row, iChName)) {
      currentChapter = getCell(row, iChName);
      currentChapterNo = getCell(row, iChNo) || String(++chapterCounter);
    } else if (desc && qty === 0 && rate === 0 && amount === 0 && !unit) {
      chapterCounter++;
      currentChapter = desc;
      currentChapterNo = getCell(row, iSrNo) || getCell(row, iItemNo) || String(chapterCounter);
      continue;
    }

    if (!desc) continue;

    let finalRate = rate;
    if (finalRate === 0 && qty > 0 && amount > 0) finalRate = amount / qty;

    items.push({
      sr_no: getCell(row, iSrNo),
      chapter_no: currentChapterNo,
      chapter_name: currentChapter,
      item_no: getCell(row, iItemNo),
      description: desc,
      unit: unit || 'NOS',
      quantity: qty,
      rate: finalRate,
      remarks: getCell(row, iRemarks),
    });
  }

  return items;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && inQuotes && line[index + 1] === '"') {
      current += '"';
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0].toLowerCase().trim());
  const indexOf = (candidates) => {
    for (const candidate of candidates) {
      const found = headers.findIndex((header) => header.replace(/[\s_]/g, '').includes(candidate.replace(/[\s_]/g, '')));
      if (found >= 0) return found;
    }
    return -1;
  };

  const iDesc = indexOf(['description', 'desc', 'item', 'particulars', 'work']);
  const iUnit = indexOf(['unit', 'uom']);
  const iQty = indexOf(['quantity', 'qty']);
  const iRate = indexOf(['rate', 'unitrate', 'price']);
  const iCh = indexOf(['chaptername', 'chapter', 'section']);
  const iChNo = indexOf(['chapterno', 'chno']);
  const iItemNo = indexOf(['itemno', 'item no', 'sl no', 'srno', 'no']);
  const iRemarks = indexOf(['remarks', 'remark', 'note']);

  const items = [];
  let currentChapter = '';
  let currentChapterNo = '';

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    if (!lines[lineIndex].trim()) continue;
    const cols = parseCSVLine(lines[lineIndex]);
    const getCell = (index) => (index >= 0 ? (cols[index] || '').trim() : '');

    const desc = getCell(iDesc);
    const qty = parseFloat(getCell(iQty)) || 0;
    const rate = parseFloat(getCell(iRate)) || 0;
    const unit = getCell(iUnit);

    if (iCh >= 0 && getCell(iCh)) {
      currentChapter = getCell(iCh);
      currentChapterNo = getCell(iChNo);
    }

    if (!desc) continue;

    items.push({
      sr_no: getCell(iItemNo),
      chapter_no: currentChapterNo || getCell(iChNo),
      chapter_name: currentChapter || getCell(iCh),
      item_no: getCell(iItemNo),
      description: desc,
      unit,
      quantity: qty,
      rate,
      remarks: getCell(iRemarks),
    });
  }

  return items;
}

async function parsePDF(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  const text = data.text;

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const items = [];
  let currentChapter = '';
  let currentChapterNo = '';
  let chapterCounter = 0;

  const units = /\b(cum|sqm|sqft|rmt|rm|mt|kg|nos|no|each|ls|lump|set|pairs?|ltr|lts?|ton|kn|m3|m2|m)\b/i;
  const isHeading = (line) => {
    const parts = line.split(/\s+/);
    if (parts.length <= 1) return false;
    const last = parts[parts.length - 1];
    if (/^[\d,]+(\.\d+)?$/.test(last)) return false;
    return /^[A-Z\s&\-/.]{4,}$/.test(line) || /^[A-Z]\s/.test(line) || /^\d+\.\s+[A-Z]/.test(line);
  };

  for (const line of lines) {
    if (isHeading(line) && !units.test(line)) {
      chapterCounter++;
      currentChapter = line.replace(/^\d+[.)]\s*/, '').trim();
      currentChapterNo = String(chapterCounter);
      continue;
    }

    const unitMatch = line.match(units);
    if (!unitMatch) continue;

    const numbers = [...line.matchAll(/[\d,]+(\.\d+)?/g)]
      .map((match) => parseFloat(match[0].replace(/,/g, '')))
      .filter((number) => !Number.isNaN(number) && number > 0);

    if (numbers.length < 1) continue;

    const unitIdx = line.indexOf(unitMatch[0]);
    const desc = line.slice(0, unitIdx).replace(/^\d+[.)]\s*/, '').trim();
    if (!desc || desc.length < 3) continue;

    items.push({
      sr_no: '',
      chapter_no: currentChapterNo,
      chapter_name: currentChapter,
      item_no: '',
      description: desc,
      unit: unitMatch[0].toUpperCase(),
      quantity: numbers[0] || 0,
      rate: numbers[1] || 0,
      remarks: '',
    });
  }

  if (items.length === 0) {
    throw new Error(
      'Could not auto-detect BOQ table rows in this PDF. ' +
      'Please convert it to Excel (.xlsx) and import that instead; Excel import works without AI.'
    );
  }

  return items;
}

async function runAIExtraction(filePath, mimeType) {
  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = process.env.BCIM_AI_VISION_MODEL || process.env.BCIM_AI_MODEL || 'llama3.2:latest';

  if (!process.env.BCIM_AI_VISION_MODEL) {
    throw new Error(
      'Image BOQ extraction needs a vision-capable Ollama model. ' +
      'Set BCIM_AI_VISION_MODEL to a model like llava or qwen2.5vl, ' +
      'or upload PDF/Excel instead.'
    );
  }

  const base64Content = fs.readFileSync(filePath).toString('base64');
  const prompt = `You are a Quantity Surveyor AI. Extract all Bill of Quantities (BOQ) items from the attached image.
Return ONLY a valid JSON array. Each object must have: chapter_no, chapter_name, item_no, description, unit, quantity (number), rate (number), remarks.
If a field is missing use "" or 0. Return raw JSON only, with no markdown and no explanation.`;

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [base64Content],
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Ollama vision request failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = data.message?.content || data.response || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

module.exports = { extractBOQItems };
