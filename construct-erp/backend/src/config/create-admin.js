// backend/src/config/create-admin.js
// Creates the company + admin user for first login.
// Usage: node src/config/create-admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

async function createAdmin() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Company
    const companyRes = await client.query(
      `INSERT INTO companies (name, gstin, address, city, state, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      ['BCIM Engineering Pvt Ltd', '29AABCB1234C1Z5',
       'BCIM Office', 'Bangalore', 'Karnataka',
       '9999999999', 'admin@bcimengineering.in']
    );

    let companyId;
    if (companyRes.rows.length > 0) {
      companyId = companyRes.rows[0].id;
    } else {
      const r = await client.query(`SELECT id FROM companies WHERE name = $1`, ['BCIM Engineering Pvt Ltd']);
      companyId = r.rows[0].id;
    }

    // Admin user
    const passwordHash = await bcrypt.hash('Admin@1234', 12);
    await client.query(
      `INSERT INTO users (company_id, employee_code, name, email, phone, password_hash, role, designation, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
       ON CONFLICT (email) DO NOTHING`,
      [companyId, 'EMP001', 'BCIM Admin', 'admin@bcimengineering.in',
       '9999999999', passwordHash, 'super_admin', 'System Administrator']
    );

    await client.query('COMMIT');

    console.log('');
    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('  Company : BCIM Engineering Pvt Ltd');
    console.log('  Email   : admin@bcimengineering.in');
    console.log('  Password: Admin@1234');
    console.log('');
    console.log('  ⚠️  Change the password after first login!');
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin();
