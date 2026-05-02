// Add amount_received column to ra_bills
// Run: node fix-ra-bills-amount-received.js
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
        ADD COLUMN IF NOT EXISTS client_tds_amount  NUMERIC(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS amount_received     NUMERIC(15,2) DEFAULT 0
    `);

    await client.query('COMMIT');
    console.log('✅ client_tds_amount and amount_received columns added to ra_bills.');
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
