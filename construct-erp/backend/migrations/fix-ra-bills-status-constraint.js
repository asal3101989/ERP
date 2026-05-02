// Fix ra_bills_status_check constraint to include 'draft' and 'verified'
// Run: node fix-ra-bills-status-constraint.js
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

    await client.query(`
      ALTER TABLE ra_bills
        DROP CONSTRAINT IF EXISTS ra_bills_status_check
    `);

    await client.query(`
      ALTER TABLE ra_bills
        ADD CONSTRAINT ra_bills_status_check
        CHECK (status IN ('draft','submitted','verified','certified','rejected','paid'))
    `);

    await client.query('COMMIT');
    console.log('✅ ra_bills_status_check constraint updated successfully.');
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
