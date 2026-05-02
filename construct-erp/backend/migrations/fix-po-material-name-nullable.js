// Make old single-item columns on purchase_orders nullable
// (items are now stored in po_items; these header columns are legacy)
// Run: node fix-po-material-name-nullable.js
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

const COLUMNS = [
  'material_name', 'quantity', 'unit', 'rate',
  'hsn_code', 'gst_rate', 'gst_amount', 'total_amount',
];

async function fix() {
  const client = await pool.connect();
  try {
    for (const col of COLUMNS) {
      try {
        await client.query(`ALTER TABLE purchase_orders ALTER COLUMN ${col} DROP NOT NULL`);
        console.log(`  ✓ ${col} → nullable`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`  ℹ️  ${col} — column does not exist, skipping`);
        } else {
          throw err;
        }
      }
    }
    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
