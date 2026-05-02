// Add performance indexes to the most-queried columns
// Run: node fix-add-indexes.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'construct_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const INDEXES = [
  // Projects — base table joined on almost every query
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_company_id    ON projects(company_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_status        ON projects(status)`,

  // Payments — Finance module
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_project_id    ON payments(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_date          ON payments(payment_date DESC)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_cost_head     ON payments(cost_head)`,

  // RA Bills — QS + Finance
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ra_bills_project_id    ON ra_bills(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ra_bills_status        ON ra_bills(status)`,

  // BOQ
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boq_items_project_id   ON boq_items(project_id)`,

  // Measurements
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_measurements_project   ON measurements(project_id)`,

  // Budget
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_items_project   ON budget_items(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_items_cost_head ON budget_items(cost_head)`,

  // Purchase Orders
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_po_project_id         ON purchase_orders(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_po_vendor_id          ON purchase_orders(vendor_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_po_status             ON purchase_orders(status)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_po_items_po_id        ON po_items(po_id)`,

  // MRS
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mrs_project_id        ON material_requisitions(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mrs_status            ON material_requisitions(status)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mrs_items_mrs_id      ON mrs_items(mrs_id)`,

  // Quotations
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotations_mrs_id     ON quotations(mrs_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotation_items_quot  ON quotation_items(quotation_id)`,

  // Workers & Attendance — HR module
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workers_project_id    ON workers(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_worker_id  ON attendance(worker_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_date       ON attendance(date DESC)`,

  // GRN
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grn_po_id             ON grn(po_id)`,

  // DPR
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dpr_project_id        ON dpr(project_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dpr_date              ON dpr(date DESC)`,

  // Users — auth queries
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_id      ON users(company_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email           ON users(email)`,
];

async function run() {
  const client = await pool.connect();
  let ok = 0, skipped = 0;
  try {
    for (const sql of INDEXES) {
      const name = sql.match(/idx_\w+/)?.[0] || '?';
      try {
        await client.query(sql);
        console.log(`  ✓ ${name}`);
        ok++;
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`  ⚠  ${name} — table/column not found, skipping`);
          skipped++;
        } else {
          throw err;
        }
      }
    }
    console.log(`\n✅ Done — ${ok} indexes created, ${skipped} skipped.`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
