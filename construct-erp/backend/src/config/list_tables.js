// backend/src/config/list_tables.js
const { pool } = require('./database');

async function list() {
  try {
    const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    console.log(JSON.stringify(r.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

list();
