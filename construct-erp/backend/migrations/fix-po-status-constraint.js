// Fix purchase_orders_status_check to include all workflow stages
// Run: node fix-po-status-constraint.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'construct_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check`);
    await client.query(`
      ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check
        CHECK (status IN (
          'pending','verified_audit','checked_finance','released_mgmt','approved',
          'draft','sent','part_received','fully_received','cancelled','rejected'
        ))
    `);
    await client.query('COMMIT');
    console.log('✅ purchase_orders_status_check updated with all workflow stages.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
