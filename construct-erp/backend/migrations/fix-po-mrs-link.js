// Adds mrs_id to purchase_orders so CS page can detect if a PO was already raised
// Run: node fix-po-mrs-link.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'construct_erp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN IF NOT EXISTS mrs_id UUID REFERENCES material_requisitions(id) ON DELETE SET NULL;
    `);
    console.log('✅ Added mrs_id column to purchase_orders');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_po_mrs_id ON purchase_orders(mrs_id);
    `);
    console.log('✅ Created index idx_po_mrs_id');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
