// backend/src/config/temp_batch_migrate.js
require('dotenv').config();
const { pool } = require('./database');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sqlPath = path.join(__dirname, '../database/migrations/inventory_batch_v1.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    console.log('Applying Phase 8 Migration...');
    await pool.query(sql);
    console.log('Successfully deployed inventory_batches and batch_transactions.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
