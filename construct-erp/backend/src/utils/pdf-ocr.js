// backend/src/utils/pdf-ocr.js
// Extracts text from any PDF — text-based or scanned (image) PDF.
// For scanned PDFs: uses pdftoppm (poppler-utils) to convert pages to PNG,
// then tesseract.js to OCR each page.

const pdfParse    = require('pdf-parse');
const { execFile } = require('child_process');
const os          = require('os');
const path        = require('path');
const fs          = require('fs');

// Check if pdftoppm is available on the server
function hasPdftoppm() {
  return new Promise(resolve => {
    execFile('pdftoppm', ['-v'], (err) => resolve(!err));
  });
}

// Convert PDF buffer → array of PNG file paths using pdftoppm
function pdfToImages(pdfBuffer) {
  return new Promise((resolve, reject) => {
    const ts        = Date.now();
    const tmpPdf    = path.join(os.tmpdir(), `erp_pdf_${ts}.pdf`);
    const outPrefix = path.join(os.tmpdir(), `erp_img_${ts}`);

    fs.writeFileSync(tmpPdf, pdfBuffer);

    execFile('pdftoppm', ['-png', '-r', '250', tmpPdf, outPrefix], err => {
      try { fs.unlinkSync(tmpPdf); } catch (_) {}
      if (err) return reject(new Error('pdftoppm failed: ' + err.message));

      const files = fs.readdirSync(os.tmpdir())
        .filter(f => f.startsWith(path.basename(outPrefix)) && f.endsWith('.png'))
        .sort()
        .map(f => path.join(os.tmpdir(), f));

      resolve(files);
    });
  });
}

// OCR a list of image files with tesseract.js, returns combined text
async function ocrImages(imagePaths) {
  // Lazy-load tesseract.js so server still starts even if not installed
  let createWorker;
  try {
    ({ createWorker } = require('tesseract.js'));
  } catch (_) {
    throw new Error('tesseract.js not installed — run: npm install tesseract.js in backend/');
  }

  const worker = await createWorker('eng', 1, {
    logger: () => {},   // suppress progress output
  });

  let fullText = '';
  for (const imgPath of imagePaths) {
    try {
      const { data: { text } } = await worker.recognize(imgPath);
      fullText += text + '\n';
    } finally {
      try { fs.unlinkSync(imgPath); } catch (_) {}
    }
  }
  await worker.terminate();
  return fullText;
}

/**
 * extractTextFromPDF(buffer)
 * Returns the full text string from a PDF buffer.
 * Auto-detects scanned vs text-based PDF.
 */
async function extractTextFromPDF(buffer) {
  // First try pdf-parse (fast, works for text PDFs)
  const parsed = await pdfParse(buffer);
  const textLen = (parsed.text || '').replace(/\s/g, '').length;

  // If we got meaningful text (>50 non-whitespace chars), use it
  if (textLen > 50) {
    return { text: parsed.text, method: 'text' };
  }

  // Scanned PDF detected — try OCR
  const hasPoppler = await hasPdftoppm();
  if (!hasPoppler) {
    throw new Error(
      'This is a scanned PDF. OCR support is not installed on the server.\n' +
      'Ask your admin to run: apt-get install -y poppler-utils && npm install tesseract.js'
    );
  }

  const images  = await pdfToImages(buffer);
  const ocrText = await ocrImages(images);
  return { text: ocrText, method: 'ocr' };
}

module.exports = { extractTextFromPDF };
