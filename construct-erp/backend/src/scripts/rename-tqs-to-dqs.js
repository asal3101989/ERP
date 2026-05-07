// backend/src/scripts/rename-tqs-to-dqs.js
// One-time migration: rename all tqs_* tables → dqs_* tables
// Handles the case where dqs_* tables already exist (empty) from ensureTables().
// Strategy: if BOTH tqs_* and dqs_* exist, check row counts.
//   - If dqs_* is empty and tqs_* has data → DROP dqs_* then RENAME tqs_* → dqs_*
//   - If dqs_* already has data → SKIP (already migrated)
//   - If only tqs_* exists → RENAME directly

require('dotenv').config();
const { pool } = require('../config/database');

// Order matters: child tables (FK referencing dqs_bills) must be dropped before parent
const RENAMES = [
  ['tqs_bill_history',     'dqs_bill_history'],
  ['tqs_bill_files',       'dqs_bill_files'],
  ['tqs_bill_line_items',  'dqs_bill_line_items'],
  ['tqs_bill_updates',     'dqs_bill_updates'],
  ['tqs_transmittal_items','dqs_transmittal_items'],
  ['tqs_bills',            'dqs_bills'],
  ['tqs_transmittals',     'dqs_transmittals'],
  ['tqs_material_tracker', 'dqs_material_tracker'],
];

async function tableExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`, [name]
  );
  return rows.length > 0;
}

async function rowCount(client, name) {
  const { rows } = await client.query(`SELECT COUNT(*) AS n FROM ${name}`);
  return parseInt(rows[0].n, 10);
}

async function run() {
  const client = await pool.connect();
  try {
    for (const [from, to] of RENAMES) {
      const fromExists = await tableExists(client, from);
      const toExists   = await tableExists(client, to);

      if (!fromExists && !toExists) {
        console.log(`  SKIP  ${from} → ${to}  (neither table exists)`);
        continue;
      }

      if (!fromExists && toExists) {
        console.log(`  DONE  ${from} → ${to}  (already renamed)`);
        continue;
      }

      if (fromExists && !toExists) {
        // Simple rename
        await client.query(`ALTER TABLE ${from} RENAME TO ${to}`);
        console.log(`  OK    ${from} → ${to}`);
        continue;
      }

      // Both exist — check if dqs_* is empty (created by ensureTables)
      const dqsCount = await rowCount(client, to);
      if (dqsCount > 0) {
        console.log(`  DONE  ${from} → ${to}  (dqs table has ${dqsCount} rows — already migrated)`);
        continue;
      }

      // dqs_* is empty, tqs_* has the real data — drop empty dqs_* then rename
      const tqsCount = await rowCount(client, from);
      console.log(`  DROP  ${to} (empty) then RENAME ${from} (${tqsCount} rows) → ${to}`);
      await client.query(`DROP TABLE ${to} CASCADE`);
      await client.query(`ALTER TABLE ${from} RENAME TO ${to}`);
      console.log(`  OK    ${from} → ${to}  (${tqsCount} rows preserved)`);
    }

    console.log('\nDone. All tqs_* tables renamed to dqs_*');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
