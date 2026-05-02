// backend/src/config/check_quotation_schema.js
const { pool } = require('./database');

async function check() {
  try {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quotations';");
    console.log('--- Quotations Table ---');
    console.log(JSON.stringify(r.rows, null, 2));

    const r2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'indent_items';");
    console.log('--- Indent Items Table ---');
    console.log(JSON.stringify(r2.rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
