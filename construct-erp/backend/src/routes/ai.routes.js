const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_CHAT_URL = `${OLLAMA_BASE_URL}/api/chat`;
const OLLAMA_MODEL = process.env.BCIM_AI_MODEL || 'llama3.2:latest';
const OLLAMA_KEEP_ALIVE = process.env.BCIM_AI_KEEP_ALIVE || '30m';
const OLLAMA_NUM_PREDICT = Number.parseInt(process.env.BCIM_AI_NUM_PREDICT || '256', 10) || 256;
let warmupStarted = false;

const authenticateOrDemo = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.includes('demo-offline-token')) {
    req.user = { id: 'demo', company_id: 'co-001', name: 'Demo User', role: 'admin' };
    return next();
  }
  return authenticate(req, res, next);
};

const SYSTEM_PROMPT = `You are BCIM AI, the intelligent assistant embedded inside BCIM Engineering Private Limited's construction ERP system (ConstructERP India Pro v3.0).

You help users with:
- Project management: BOQ, estimation, RA bills, measurement books, DPR
- Finance: GST billing, TDS register (194C/194J), budget vs actual, payments, P&L
- Procurement: Vendor management, purchase orders, GRN, inventory
- HR & Payroll: Worker management, attendance, PF/ESI-compliant payroll, BOCW
- HSE: Safety dashboards, incidents, Permit to Work (PTW), PPE tracking
- Stores: Material Requisition (MRS), Issue Notes (MIN), Store Ledger
- Assets & IT: Asset register, IT assets, help desk tickets, AMC/licenses
- CRM: Client bookings, project reports

Indian construction context:
- GST (CGST/SGST/IGST), TDS sections 194C and 194J, RERA, BOCW Act
- RA bills, Running Account bills, BOQ (Bill of Quantities), WBS
- Subcontractor management, retention money, mobilization advance
- Indian labour laws, PF (12%), ESI (3.25% employer), professional tax
- Construction project lifecycle: tendering to award to execution to billing to closure

Keep responses concise and practical. Use bullet points for lists. When referencing ERP modules, mention the menu path (for example, "Go to QS & Billing > RA Bills"). Always respond in the user's language, defaulting to English unless they write in another language.`;

function buildMessages(messages) {
  return messages.slice(-20).map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: String(message.content || '').slice(0, 4000),
  }));
}

async function streamOllamaChat(res, messages, options = {}) {
  const upstream = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      keep_alive: OLLAMA_KEEP_ALIVE,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      options: {
        temperature: options.temperature ?? 0.2,
        top_p: options.top_p ?? 0.9,
        num_predict: options.num_predict ?? OLLAMA_NUM_PREDICT,
      },
    }),
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    throw new Error(details || `Ollama request failed with status ${upstream.status}`);
  }

  const reader = upstream.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (!reader) throw new Error('Ollama stream did not return a readable body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        const content = parsed.message?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ type: 'text', text: content })}\n\n`);
        }
        if (parsed.done) {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        }
      } catch (_) {
        // Ignore malformed chunks and continue streaming.
      }
    }
  }
}

async function warmupOllamaModel() {
  if (warmupStarted) return;
  warmupStarted = true;

  try {
    await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        keep_alive: OLLAMA_KEEP_ALIVE,
        messages: [
          { role: 'system', content: 'Warm up the model and respond with OK.' },
          { role: 'user', content: 'OK' },
        ],
        options: {
          temperature: 0,
          num_predict: 1,
        },
      }),
    });
  } catch (err) {
    console.warn('[AI] warmup skipped:', err.message);
  }
}

setImmediate(() => {
  warmupOllamaModel();
});

router.post('/chat', authenticateOrDemo, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const sanitised = buildMessages(messages);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    await streamOllamaChat(res, sanitised);
  } catch (err) {
    console.error('[AI] stream error:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;
