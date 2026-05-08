// src/hooks/useOCRExtract.js
// Renders PDF page 1 → JPEG via pdfjs-dist → sends to backend → Gemini Vision extracts data
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

const WORKER_SRC =
  'https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.js';

export function useOCRExtract() {
  const [ocrLoading, setOcrLoading] = useState(false);

  const extract = async (file) => {
    setOcrLoading(true);
    try {
      // ── Step 1: Render PDF page 1 to canvas
      toast('Rendering PDF page…', { id: 'ocr', icon: '🖼️' });
      let imageBase64;
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;

        const arrayBuffer = await file.arrayBuffer();
        const pdf      = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const page     = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.5 });

        const canvas  = document.createElement('canvas');
        canvas.width  = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        // Convert to base64 JPEG (smaller than PNG, Gemini handles it fine)
        imageBase64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      } catch (e) {
        throw new Error('PDF render failed: ' + e.message);
      }

      // ── Step 2: Send to backend → Gemini Vision
      toast('Reading document with AI…', { id: 'ocr', icon: '🤖' });
      let extracted;
      try {
        const res = await api.post('/ocr/extract-po', {
          image_base64: imageBase64,
          mime_type:    'image/jpeg',
        });
        extracted = res.data?.data;
      } catch (e) {
        const msg = e.response?.data?.error || e.message;
        throw new Error('AI extraction failed: ' + msg);
      }

      toast.dismiss('ocr');

      if (!extracted || (!extracted.po_date && !extracted.grand_total && !extracted.items?.length)) {
        toast.error('AI could not find any data — try filling manually', { duration: 5000 });
        return null;
      }

      console.log('[Gemini Extracted]', extracted);
      return extracted;   // { po_date, grand_total, gst_pct, items[] }

    } catch (err) {
      toast.dismiss('ocr');
      toast.error(err.message, { duration: 8000 });
      console.error('[OCR Error]', err);
      return null;
    } finally {
      setOcrLoading(false);
    }
  };

  return { extract, ocrLoading };
}
