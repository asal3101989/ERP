// backend/src/config/check_invoice_schema.js
const { pool } = require('./database');

async function check() {
  try {
    const inv = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoices'");
    console.log('--- INVOICES SCHEMA ---');
    console.log(JSON.stringify(inv.rows, null, 2));

    const pay = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments'");
    console.log('--- PAYMENTS SCHEMA ---');
    console.log(JSON.stringify(pay.rows, null, 2));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
