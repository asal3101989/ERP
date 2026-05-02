const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'src', 'config', 'quality_schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('Applying QA/QC Schema...');
    await client.query(sql);
    console.log('QA/QC Schema applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
