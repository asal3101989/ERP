// src/hooks/useOCRExtract.js
// Client-side OCR for scanned PDFs using pdfjs-dist + tesseract.js
// Renders PDF page 1 → canvas → OCR → extracts date + amount

import { useState } from 'react';

// ── Parse date from OCR text (DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY)
function extractDate(text) {
  const patterns = [
    /(?:date|dated|wo date|po date|work order date)[:\s]*(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/gi,
    /(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/g,
  ];
  for (const pat of patterns) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m) {
      const d = m[m.length - 3], mo = m[m.length - 2], y = m[m.length - 1];
      return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  }
  return null;
}

// ── Parse amount from OCR text — looks for NET TOTAL / GRAND TOTAL / TOTAL labels
function extractAmount(text) {
  const upper = text.toUpperCase();
  // Try labelled total first
  const labelled = [
    /NET\s*TOTAL[\s:₹]*([\d,]+(?:\.\d+)?)/,
    /GRAND\s*TOTAL[\s:₹]*([\d,]+(?:\.\d+)?)/,
    /TOTAL\s*AMOUNT[\s:₹]*([\d,]+(?:\.\d+)?)/,
    /TOTAL[\s:₹]*([\d,]+(?:\.\d+)?)/,
  ];
  for (const pat of labelled) {
    const m = pat.exec(upper);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g,''));
      if (val > 0) return val.toString();
    }
  }
  // Fallback: largest number ≥ 1000 in the document
  const nums = [...upper.matchAll(/\b([\d,]+(?:\.\d{2})?)\b/g)]
    .map(m => parseFloat(m[1].replace(/,/g,'')))
    .filter(n => n >= 1000);
  if (nums.length) return Math.max(...nums).toString();
  return null;
}

// ── Parse GST % from text
function extractGST(text) {
  const m = text.match(/GST\s*[@\s]*(\d{1,2})\s*%/i);
  return m ? m[1] : null;
}

export function useOCRExtract() {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError,   setOcrError]   = useState(null);

  const extract = async (file) => {
    setOcrLoading(true);
    setOcrError(null);

    try {
      // ── 1. Render PDF page 1 to canvas using pdfjs-dist
      const [pdfjsLib, { createWorker }] = await Promise.all([
        import('pdfjs-dist'),
        import('tesseract.js'),
      ]);

      // Use CDN worker to avoid Vite bundling issues
      const pdfjsVersion = pdfjsLib.version;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf  = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // Scale up for better OCR accuracy
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas   = document.createElement('canvas');
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // ── 2. Run Tesseract OCR on the canvas
      const worker = await createWorker('eng', 1, {
        logger: () => {},  // suppress progress logs
      });
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      // ── 3. Parse the OCR text
      const date   = extractDate(text);
      const amount = extractAmount(text);
      const gst    = extractGST(text);

      return { date, amount, gst, rawText: text };
    } catch (err) {
      setOcrError(err.message || 'OCR failed');
      return null;
    } finally {
      setOcrLoading(false);
    }
  };

  return { extract, ocrLoading, ocrError };
}
