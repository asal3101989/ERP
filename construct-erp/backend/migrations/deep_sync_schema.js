// deep_sync_schema.js
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
    console.log('--- DEEP SYNC: Database Schema Alignment ---');
    
    // 1. RA_BILLS Table Fix
    console.log('Synchronizing RA_BILLS...');
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS certified_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(200),
      ADD COLUMN IF NOT EXISTS contractor_gstin VARCHAR(15),
      ADD COLUMN IF NOT EXISTS contractor_pan VARCHAR(10);
    `);
    
    // 2. INVOICES Table Fix
    console.log('Synchronizing INVOICES...');
    await client.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id),
      ADD COLUMN IF NOT EXISTS po_id UUID,
      ADD COLUMN IF NOT EXISTS grn_id UUID,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_details JSONB,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES users(id);
    `);
    
    // Check if constraints exist or add them
    try {
      await client.query(`
        ALTER TABLE invoices 
        ADD CONSTRAINT check_invoice_status CHECK (status IN ('pending','verified','authorized','paid','cancelled'));
      `);
    } catch(e) { /* ignore if already exists */ }

    console.log('\nSUCCESS: All schemas aligned with backend logic.');
  } catch (err) {
    console.error('\nERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
