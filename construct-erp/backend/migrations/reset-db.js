/**
 * reset-db.js
 * Wipes ALL data from the database and creates one fresh admin user.
 * Run: node reset-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

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
    console.log('\n========================================');
    console.log('  BCIM Engineering ERP — Database Reset');
    console.log('========================================\n');

    // 1. Wipe all data (order matters for FK constraints)
    console.log('Wiping all data...');
    await client.query(`
      TRUNCATE TABLE
        audit_logs,
        refresh_tokens,
        payment_schedules,
        unit_bookings,
        amc_contracts,
        software_licenses,
        it_tickets,
        it_assets,
        maintenance_records,
        asset_movements,
        assets,
        stock_transactions,
        inventory,
        grn,
        purchase_orders,
        vendors,
        ppe_records,
        risk_assessments,
        safety_inspections,
        corrective_actions,
        incidents,
        permits,
        payroll,
        attendance,
        workers,
        daily_progress_reports,
        budget_items,
        payments,
        invoices,
        material_reconciliation,
        ra_bill_items,
        ra_bills,
        measurements,
        boq_items,
        project_members,
        projects,
        work_orders,
        users,
        companies
      RESTART IDENTITY CASCADE
    `);
    console.log('  All tables wiped.\n');

    // 2. Create company
    const companyResult = await client.query(`
      INSERT INTO companies (name, city, state, email)
      VALUES ('BCIM Engineering Private Limited', 'Pune', 'Maharashtra', 'admin@bcimengineering.in')
      RETURNING id
    `);
    const companyId = companyResult.rows[0].id;
    console.log(`  Company created: BCIM Engineering Private Limited`);
    console.log(`  Company ID: ${companyId}`);

    // 3. Create admin user
    const hash = await bcrypt.hash('Bcim@2024', 12);
    const userResult = await client.query(`
      INSERT INTO users (company_id, employee_code, name, email, password_hash, role, department, designation, is_active)
      VALUES ($1, 'EMP-001', 'Admin', 'admin@bcimengineering.in', $2, 'admin', 'Management', 'ERP Administrator', true)
      RETURNING id, email, role
    `, [companyId, hash]);

    const adminUser = userResult.rows[0];
    console.log(`\n  Admin user created:`);
    console.log(`  Email      : ${adminUser.email}`);
    console.log(`  Password   : Bcim@2024`);
    console.log(`  Role       : ${adminUser.role}`);

    console.log('\n========================================');
    console.log('  Database reset complete!');
    console.log('  Login: admin@bcimengineering.in');
    console.log('  Pass:  Bcim@2024');
    console.log('========================================\n');

  } catch (err) {
    console.error('\nERROR:', err.message);
    if (err.message.includes('does not exist')) {
      console.error('Some tables may not exist — run migrations first: npm run migrate');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
