// backend/src/scripts/add-po-columns.js
// Adds missing columns to purchase_orders and po_items to match BCIM PO format
require('dotenv').config();
const { pool } = require('../config/database');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS po_ref_no       VARCHAR(100),
        ADD COLUMN IF NOT EXISTS po_req_no        VARCHAR(100),
        ADD COLUMN IF NOT EXISTS approval_no      VARCHAR(100),
        ADD COLUMN IF NOT EXISTS delivery_address TEXT,
        ADD COLUMN IF NOT EXISTS narration        TEXT,
        ADD COLUMN IF NOT EXISTS cgst_rate        NUMERIC(5,2) DEFAULT 9,
        ADD COLUMN IF NOT EXISTS sgst_rate        NUMERIC(5,2) DEFAULT 9,
        ADD COLUMN IF NOT EXISTS igst_rate        NUMERIC(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gst_inclusive    BOOLEAN DEFAULT false;
    `);
    console.log('✅ purchase_orders columns added');

    await client.query(`
      ALTER TABLE po_items
        ADD COLUMN IF NOT EXISTS mix_design VARCHAR(300),
        ADD COLUMN IF NOT EXISTS req_date   DATE;
    `);
    console.log('✅ po_items columns added');

    console.log('\nDone.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
