require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running RA Bill Schema Upgrade...');
    await client.query('BEGIN');

    // 1. Add Price Escalation column
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS price_escalation NUMERIC(15,2) DEFAULT 0;
    `);

    // 2. Ensure material recovery columns exist (verification)
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS material_recovery_cement NUMERIC(15,2) DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS material_recovery_steel NUMERIC(15,2) DEFAULT 0;
    `);

    await client.query('COMMIT');
    console.log('✅ RA Bill Schema upgraded successfully with Escalation and Recovery splits.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
