// Inventory Rate & Category Migration
// Adds unit_rate and category columns to inventory table
// Run: node fix-inventory-rate-category.js

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'construct_erp',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const safe = async (sql, label) => {
      try {
        await client.query(sql);
        console.log(`  ✓ ${label}`);
      } catch (e) {
        console.log(`  - ${label} (skipped: ${e.message})`);
      }
    };

    console.log('\n[inventory] Adding rate & category columns...');

    await safe(
      `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit_rate NUMERIC(12,2) DEFAULT 0`,
      'unit_rate column'
    );
    await safe(
      `ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category VARCHAR(100)`,
      'category column'
    );

    // Back-fill unit_rate from the most recent GRN item rate for each material
    await safe(`
      UPDATE inventory i
      SET unit_rate = sub.rate
      FROM (
        SELECT DISTINCT ON (gi.material_name, g.project_id)
          gi.material_name,
          g.project_id,
          gi.rate
        FROM grn_items gi
        JOIN grn g ON gi.grn_id = g.id
        WHERE gi.rate IS NOT NULL AND gi.rate > 0
        ORDER BY gi.material_name, g.project_id, g.grn_date DESC
      ) sub
      WHERE i.material_name = sub.material_name
        AND i.project_id   = sub.project_id
        AND (i.unit_rate IS NULL OR i.unit_rate = 0)
    `, 'back-fill unit_rate from latest GRN rates');

    await client.query('COMMIT');
    console.log('\n✅  Migration complete.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
