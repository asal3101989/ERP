// backend/fix-tqs-sl-number.js
// One-time fix: rename TQS-2026-0313 → 351
// Run: node fix-tqs-sl-number.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const { rows } = await pool.query(
    `UPDATE tqs_bills SET sl_number = '351' WHERE sl_number = 'TQS-2026-0313' RETURNING id, inv_number, vendor_name`
  );
  if (rows.length) {
    console.log(`✓ Updated: ${rows[0].inv_number} (${rows[0].vendor_name}) → SL 351`);
  } else {
    console.log('No bill found with sl_number = TQS-2026-0313');
  }
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
