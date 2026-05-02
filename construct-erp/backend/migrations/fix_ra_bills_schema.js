// fix_ra_bills_schema.js
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
    console.log('Adjusting RA Bills schema...');
    
    // Add missing audited columns
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS certified_by UUID REFERENCES users(id);
    `);
    
    // Ensure contractor details match
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(200),
      ADD COLUMN IF NOT EXISTS contractor_gstin VARCHAR(15),
      ADD COLUMN IF NOT EXISTS contractor_pan VARCHAR(10);
    `);

    console.log('Schema adjusted successfully.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
