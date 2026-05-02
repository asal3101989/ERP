// src/routes/chat.routes.js — ERP Team Chat REST endpoints
const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// ── Ensure table exists (runs once on first request) ─────────────────────────
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id           SERIAL PRIMARY KEY,
      channel      VARCHAR(100) NOT NULL DEFAULT 'general',
      sender_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      sender_name  VARCHAR(200) NOT NULL,
      sender_role  VARCHAR(100),
      text         TEXT,
      file_name    VARCHAR(500),
      file_size    VARCHAR(50),
      file_url     TEXT,
      pinned       BOOLEAN DEFAULT FALSE,
      reactions    JSONB DEFAULT '[]',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
  `);
  tableReady = true;
}

// ── GET /chat/messages?channel=finance&limit=100 ──────────────────────────────
router.get('/messages', async (req, res) => {
  await ensureTable();
  const { channel = 'general', limit = 100 } = req.query;
  const result = await query(
    `SELECT * FROM chat_messages
     WHERE channel = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [channel, Math.min(parseInt(limit) || 100, 500)]
  );
  res.json({ messages: result.rows });
});

// ── POST /chat/messages ───────────────────────────────────────────────────────
router.post('/messages', async (req, res) => {
  await ensureTable();
  const { channel = 'general', text, file_name, file_size, file_url } = req.body;
  if (!text && !file_name) return res.status(400).json({ error: 'Message text or file required' });

  const sender_name = req.user.name || req.user.username || 'Unknown';
  const sender_role = req.user.role || '';

  const result = await query(
    `INSERT INTO chat_messages
       (channel, sender_id, sender_name, sender_role, text, file_name, file_size, file_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [channel, req.user.id, sender_name, sender_role, text || null, file_name || null, file_size || null, file_url || null]
  );
  res.json({ message: result.rows[0] });
});

// ── PATCH /chat/messages/:id/pin ──────────────────────────────────────────────
router.patch('/messages/:id/pin', async (req, res) => {
  await ensureTable();
  const result = await query(
    `UPDATE chat_messages SET pinned = NOT pinned WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Message not found' });
  res.json({ message: result.rows[0] });
});

// ── PATCH /chat/messages/:id/react ───────────────────────────────────────────
router.patch('/messages/:id/react', async (req, res) => {
  await ensureTable();
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });

  const existing = await query(`SELECT reactions FROM chat_messages WHERE id = $1`, [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Message not found' });

  let reactions = existing.rows[0].reactions || [];
  const idx = reactions.findIndex(r => r.e === emoji);
  if (idx >= 0) {
    reactions[idx].c = (reactions[idx].c || 1) + 1;
  } else {
    reactions.push({ e: emoji, c: 1 });
  }

  const result = await query(
    `UPDATE chat_messages SET reactions = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(reactions), req.params.id]
  );
  res.json({ message: result.rows[0] });
});

// ── DELETE /chat/messages/:id ─────────────────────────────────────────────────
router.delete('/messages/:id', async (req, res) => {
  await ensureTable();
  await query(`DELETE FROM chat_messages WHERE id = $1 AND sender_id = $2`, [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ── GET /chat/channels — list channels with last message + unread count ───────
router.get('/channels', async (req, res) => {
  await ensureTable();
  const result = await query(`
    SELECT
      channel,
      COUNT(*)::int           AS total_messages,
      MAX(created_at)         AS last_activity,
      (SELECT text FROM chat_messages cm2
       WHERE cm2.channel = cm.channel
       ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT sender_name FROM chat_messages cm3
       WHERE cm3.channel = cm.channel
       ORDER BY created_at DESC LIMIT 1) AS last_sender
    FROM chat_messages cm
    GROUP BY channel
    ORDER BY MAX(created_at) DESC
  `);
  res.json({ channels: result.rows });
});

module.exports = router;
