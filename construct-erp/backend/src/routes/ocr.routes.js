// src/routes/ocr.routes.js
// POST /ocr/extract-po
// Accepts a base64-encoded image of a PO page, calls Google Gemini Vision,
// returns structured JSON: { po_date, grand_total, gst_pct, items[] }
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

router.post('/extract-po', authenticate, async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY not configured in .env' });
    }

    const { image_base64, mime_type = 'image/jpeg' } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

    const prompt = `You are a construction ERP data-entry assistant.
Look at this Purchase Order document image and extract the following fields.
Return ONLY a valid JSON object — no markdown, no explanation, just the JSON.

{
  "po_date":    "YYYY-MM-DD or null",
  "grand_total": number or null,
  "gst_pct":    number or null,
  "items": [
    {
      "description": "string",
      "quantity":    number,
      "unit":        "LS|Nos|Kg|MT|Sqm|Sqft|Rmt|Ltr|Cum|Bags|Sets|Lot or best match",
      "rate":        number,
      "gst_rate":    number
    }
  ]
}

Rules:
- po_date: the date printed on the PO (DD/MM/YYYY → convert to YYYY-MM-DD)
- grand_total: the final total amount including GST (look for "Grand Total", "Total Amount", "Net Amount")
- gst_pct: overall GST percentage if shown, else null
- items: all line items from the PO table with their quantities, units and rates
- If a field is not found, use null for scalars or [] for items
- For Indian number formatting (1,00,000) strip commas and parse as number`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type, data: image_base64 } },
        ],
      }],
      generationConfig: {
        temperature:     0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini OCR] API error:', errText);
      return res.status(502).json({ error: `Gemini API error: ${response.status}` });
    }

    const data    = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    let extracted = {};
    try {
      // Strip any markdown code fences if present
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      extracted = JSON.parse(cleaned);
    } catch (e) {
      console.error('[Gemini OCR] JSON parse error:', rawText);
      return res.status(422).json({ error: 'Could not parse Gemini response', raw: rawText });
    }

    res.json({ success: true, data: extracted });
  } catch (err) {
    console.error('[Gemini OCR]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
