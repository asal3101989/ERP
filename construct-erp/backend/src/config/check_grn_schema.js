// backend/src/config/check_grn_schema.js
const { pool } = require('./database');

async function check() {
  try {
    const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'grns';");
    console.log(JSON.stringify(r.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
