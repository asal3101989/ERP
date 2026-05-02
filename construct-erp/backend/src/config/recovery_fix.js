// backend/src/config/recovery_fix.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./database');

async function applyRecoveryFix() {
  console.log('--- Applying Recovery Integration Fix ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding recovery_rate to consumption_norms...');
    await client.query(`
      ALTER TABLE consumption_norms 
      ADD COLUMN IF NOT EXISTS recovery_rate NUMERIC(12,2) DEFAULT 0
    `);

    console.log('Adding material_recovery_total to ra_bills...');
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS material_recovery_total NUMERIC(15,2) DEFAULT 0
    `);

    await client.query('COMMIT');
    console.log('--- Recovery Sync Successful ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error applying recovery fix:', err);
  } finally {
    client.release();
  }
}

applyRecoveryFix().then(() => process.exit());
