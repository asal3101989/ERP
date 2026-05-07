// backend/src/scripts/fix-users-role-check.js
// Drops and recreates the users_role_check constraint with the full role list
require('dotenv').config();
const { pool } = require('../config/database');

async function run() {
  const client = await pool.connect();
  try {
    // Drop old constraint (name may vary — try both common names)
    await client.query(`
      ALTER TABLE users
        DROP CONSTRAINT IF EXISTS users_role_check,
        DROP CONSTRAINT IF EXISTS users_role_check1;
    `);
    console.log('✅ Old role constraint dropped');

    // Recreate with full role list
    await client.query(`
      ALTER TABLE users
        ADD CONSTRAINT users_role_check CHECK (role IN (
          'super_admin','admin','project_manager','site_engineer',
          'accountant','hr','qs_engineer','hse_officer',
          'it_admin','vendor','client','employee','viewer'
        ));
    `);
    console.log('✅ New role constraint added');

    console.log('\nDone. All roles are now allowed.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
