// backend/src/scripts/rename-tqs-to-dqs.js
// One-time migration: rename all tqs_* tables → dqs_* tables
// Safe to run multiple times (uses IF EXISTS + checks before renaming)

require('dotenv').config();
const { pool } = require('../config/database');

const RENAMES = [
  ['tqs_bills',              'dqs_bills'],
  ['tqs_bill_updates',       'dqs_bill_updates'],
  ['tqs_bill_line_items',    'dqs_bill_line_items'],
  ['tqs_bill_files',         'dqs_bill_files'],
  ['tqs_bill_history',       'dqs_bill_history'],
  ['tqs_transmittals',       'dqs_transmittals'],
  ['tqs_transmittal_items',  'dqs_transmittal_items'],
  ['tqs_material_tracker',   'dqs_material_tracker'],
];

async function run() {
  const client = await pool.connect();
  try {
    for (const [from, to] of RENAMES) {
      // Check if old table exists
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`, [from]
      );
      if (rows.length === 0) {
        console.log(`  SKIP  ${from} → ${to}  (old table does not exist)`);
        continue;
      }
      // Check if new table already exists
      const { rows: newRows } = await client.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`, [to]
      );
      if (newRows.length > 0) {
        console.log(`  SKIP  ${from} → ${to}  (new table already exists)`);
        continue;
      }
      await client.query(`ALTER TABLE ${from} RENAME TO ${to}`);
      console.log(`  OK    ${from} → ${to}`);
    }
    console.log('\nDone. All tqs_* tables renamed to dqs_*');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
