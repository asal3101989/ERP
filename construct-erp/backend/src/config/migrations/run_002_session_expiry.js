// Run: node src/config/migrations/run_002_session_expiry.js
require('dotenv').config();
const { pool } = require('../database');

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running migration 002: session expiry...');

    await client.query(`
      ALTER TABLE refresh_tokens
        ADD COLUMN IF NOT EXISTS login_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);
    console.log('✅ Added login_at column');

    await client.query(`DELETE FROM refresh_tokens;`);
    console.log('✅ Purged existing long-lived tokens (all users will re-login)');

    console.log('✅ Migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
