// src/hooks/useOCRExtract.js
// Client-side OCR for scanned PDFs using pdfjs-dist + tesseract.js
import { useState } from 'react';
import toast from 'react-hot-toast';

function extractDate(text) {
  const patterns = [
    /(?:date|dated|wo\s*date|po\s*date|work\s*order\s*date)[:\s]*(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/gi,
    /(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})/g,
  ];
  for (const pat of patterns) {
    pat.lastIndex = 0;
    const m = pat.exec(text);
    if (m) {
      const d = m[m.length - 3], mo = m[m.length - 2], y = m[m.length - 1];
      const dNum = parseInt(d), mNum = parseInt(mo);
      if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12)
        return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  }
  return null;
}

function extractAmount(text) {
  const upper = text.toUpperCase();
  const labelled = [
    /NET\s*TOTAL[\s:₹Rs.]*([\d,]+(?:\.\d+)?)/,
    /GRAND\s*TOTAL[\s:₹Rs.]*([\d,]+(?:\.\d+)?)/,
    /TOTAL\s*AMOUNT[\s:₹Rs.]*([\d,]+(?:\.\d+)?)/,
    /AMOUNT[\s:₹Rs.]*([\d,]+(?:\.\d+)?)/,
    /TOTAL[\s:₹Rs.]*([\d,]+(?:\.\d+)?)/,
  ];
  for (const pat of labelled) {
    const m = pat.exec(upper);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g,''));
      if (val >= 100) return val.toString();
    }
  }
  const nums = [...upper.matchAll(/\b([\d,]{4,}(?:\.\d{2})?)\b/g)]
    .map(m => parseFloat(m[1].replace(/,/g,'')))
    .filter(n => n >= 1000);
  if (nums.length) return Math.max(...nums).toString();
  return null;
}

function extractGST(text) {
  const m = text.match(/GST\s*[@\s]*(\d{1,2})\s*%/i);
  return m ? m[1] : null;
}

export function useOCRExtract() {
  const [ocrLoading, setOcrLoading] = useState(false);

  const extract = async (file) => {
    setOcrLoading(true);

    try {
      // ── Step 1: Load pdfjs-dist
      toast('Step 1/3: Loading PDF library…', { id: 'ocr', icon: '📄' });
      let pdfjsLib;
      try {
        pdfjsLib = await import('pdfjs-dist');
      } catch (e) {
        throw new Error('PDF library failed to load: ' + e.message);
      }

      // Worker: try unpkg first, fall back to jsdelivr
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      // ── Step 2: Render PDF page 1 → canvas
      toast('Step 2/3: Rendering PDF page…', { id: 'ocr', icon: '🖼️' });
      let canvas;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf  = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.5 });
        canvas = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      } catch (e) {
        throw new Error('PDF render failed: ' + e.message);
      }

      // ── Step 3: Tesseract OCR
      toast('Step 3/3: Running OCR (may take 15–30s)…', { id: 'ocr', icon: '🔍' });
      let text = '';
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, { logger: () => {} });
        const result = await worker.recognize(canvas);
        text = result.data.text;
        await worker.terminate();
      } catch (e) {
        throw new Error('OCR engine failed: ' + e.message);
      }

      toast.dismiss('ocr');

      if (!text.trim()) {
        toast.error('OCR produced no text — image may be too dark or blurry', { duration: 5000 });
        return null;
      }

      // ── Step 4: Parse
      const date   = extractDate(text);
      const amount = extractAmount(text);
      const gst    = extractGST(text);

      // Debug: log raw OCR text to console so we can tune if needed
      console.log('[OCR Raw Text]', text);
      console.log('[OCR Extracted]', { date, amount, gst });

      return { date, amount, gst, rawText: text };

    } catch (err) {
      toast.dismiss('ocr');
      // Show the specific error so we can debug
      toast.error(err.message, { duration: 8000 });
      console.error('[OCR Error]', err);
      return null;
    } finally {
      setOcrLoading(false);
    }
  };

  return { extract, ocrLoading };
}
