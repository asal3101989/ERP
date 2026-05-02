// backend/fix-users-role-constraint.js
// Adds 'employee' to the users.role CHECK constraint
// Run: node fix-users-role-constraint.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop existing constraint and recreate with 'employee' included
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN (
          'super_admin','admin','project_manager','site_engineer',
          'accountant','hr','qs_engineer','hse_officer',
          'it_admin','vendor','client','employee'
        ))
    `);

    await client.query('COMMIT');
    console.log('✓ users_role_check constraint updated — employee role now allowed');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
