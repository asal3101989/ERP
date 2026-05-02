// backend/fix-snag-tables.js
// Run: node fix-snag-tables.js
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
    console.log('Creating snag_items table...');

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS snag_items (
        id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id        UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        snag_code         VARCHAR(50),
        title             VARCHAR(200) NOT NULL,
        description       TEXT,
        zone              VARCHAR(200),
        trade             VARCHAR(50)  DEFAULT 'other',
        priority          VARCHAR(20)  DEFAULT 'medium',
        status            VARCHAR(30)  DEFAULT 'open',
        photos            JSONB        DEFAULT '[]',
        due_date          DATE,
        assigned_to_name  VARCHAR(200),
        assigned_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
        rectification_notes TEXT,
        qa_remarks        TEXT,
        qa_signed_off_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        qa_signed_off_at  TIMESTAMPTZ,
        closed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
        closed_at         TIMESTAMPTZ,
        raised_by         UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at        TIMESTAMPTZ  DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    console.log('  snag_items ✓');

    // Indexes
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_snag_project ON snag_items(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_snag_status  ON snag_items(status)`,
      `CREATE INDEX IF NOT EXISTS idx_snag_trade   ON snag_items(trade)`,
      `CREATE INDEX IF NOT EXISTS idx_snag_zone    ON snag_items(zone)`,
    ];
    for (const sql of indexes) {
      await client.query(sql);
    }
    console.log('  4 indexes ✓');

    console.log('\nSnag/Punch List migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
