// consumption_norms_fix.js
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
    console.log('--- CONSUMPTION NORMS ACTIVATION: STARTING ---');

    await client.query(`
      CREATE TABLE IF NOT EXISTS consumption_norms (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        boq_item_id UUID REFERENCES boq_items(id) ON DELETE CASCADE,
        material_name VARCHAR(100) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        norm_quantity NUMERIC(10,4) NOT NULL, -- ratio (e.g. 0.35 bags/CUM)
        allowed_wastage_pct NUMERIC(5,2) DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('\n--- RATIO-BASED AUDITING ENABLED ---');
  } catch (err) {
    console.error('\nFAIL:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
