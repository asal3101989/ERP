// project_finance_fix.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'construct_erp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('--- PROJECT FINANCE EXPANSION: STARTING ---');

    await client.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS retention_percent NUMERIC(5,2) DEFAULT 5,
      ADD COLUMN IF NOT EXISTS mobilization_advance_total NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS mobilization_advance_recovered NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS recovery_percentage NUMERIC(5,2) DEFAULT 10;
    `);

    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS bill_period_from DATE,
      ADD COLUMN IF NOT EXISTS bill_period_to DATE,
      ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 18,
      ADD COLUMN IF NOT EXISTS retention_percent NUMERIC(5,2) DEFAULT 5,
      ADD COLUMN IF NOT EXISTS mobilization_advance_recovery NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS material_recovery_total NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2) DEFAULT 2,
      ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(15,2);
    `);

    console.log('\n--- FINANCIAL CONTROLS ACTIVATED ---');
  } catch (err) {
    console.error('\nFAIL:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
