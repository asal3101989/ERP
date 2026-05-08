// src/hooks/useOCRExtract.js
// Sends the raw PDF file to the backend → Gemini Vision extracts structured data.
// No pdfjs, no tesseract — Gemini reads PDFs natively.
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/client';

export function useOCRExtract() {
  const [ocrLoading, setOcrLoading] = useState(false);

  const extract = async (file) => {
    setOcrLoading(true);
    try {
      toast('Reading document with AI…', { id: 'ocr', icon: '🤖' });

      // Convert PDF file to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      // Send to backend → Gemini
      const res = await api.post('/ocr/extract-po', {
        image_base64: base64,
        mime_type:    'application/pdf',
      }, { timeout: 60000 });

      toast.dismiss('ocr');

      const extracted = res.data?.data;
      console.log('[Gemini Extracted]', extracted);

      if (!extracted || (!extracted.po_date && !extracted.grand_total && !(extracted.items?.length))) {
        toast.error('AI could not find data — fill manually', { duration: 5000 });
        return null;
      }

      return extracted; // { po_date, grand_total, gst_pct, items[] }

    } catch (err) {
      toast.dismiss('ocr');
      const msg = err.response?.data?.error || err.message;
      toast.error('AI failed: ' + msg, { duration: 8000 });
      console.error('[Gemini OCR Error]', err.response?.data || err);
      return null;
    } finally {
      setOcrLoading(false);
    }
  };

  return { extract, ocrLoading };
}
