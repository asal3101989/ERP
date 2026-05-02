// master_industrial_fix.js
require('dotenv').config();
const { Pool } = require('pg');

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
    console.log('--- ULTIMATE MASTER INDUSTRIAL FIX: STARTING ---');

    // 1. Fixing PURCHASE ORDERS
    console.log('Fixing Purchase Orders module...');
    await client.query(`
      ALTER TABLE purchase_orders 
      ADD COLUMN IF NOT EXISTS sub_total NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_gst NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS grand_total NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS serial_no_formatted VARCHAR(100),
      ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
      ADD COLUMN IF NOT EXISTS bank_details TEXT,
      ADD COLUMN IF NOT EXISTS verified_procurement_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS verified_procurement_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS checked_finance_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS checked_finance_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS released_mgmt_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS released_mgmt_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS authorized_md_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS authorized_md_at TIMESTAMPTZ;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS po_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
        material_name VARCHAR(200) NOT NULL,
        hsn_code VARCHAR(10),
        quantity NUMERIC(12,3) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        rate NUMERIC(12,2) NOT NULL,
        gst_rate NUMERIC(5,2) DEFAULT 18,
        gst_amount NUMERIC(15,2) DEFAULT 0,
        total_amount NUMERIC(15,2) DEFAULT 0,
        purpose TEXT,
        sort_order INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Fixing GRNs
    console.log('Fixing GRN module...');
    await client.query(`
      ALTER TABLE grn 
      ADD COLUMN IF NOT EXISTS gate_pass_no VARCHAR(50),
      ADD COLUMN IF NOT EXISTS wb_slip_no VARCHAR(50),
      ADD COLUMN IF NOT EXISTS total_quantity NUMERIC(12,3) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS serial_no_formatted VARCHAR(100),
      ADD COLUMN IF NOT EXISTS verified_stores_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS verified_stores_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS approved_qc_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS approved_qc_at TIMESTAMPTZ;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS grn_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        grn_id UUID REFERENCES grn(id) ON DELETE CASCADE,
        po_item_id UUID,
        material_name VARCHAR(200) NOT NULL,
        quantity_received NUMERIC(12,3) NOT NULL,
        unit VARCHAR(20),
        quality_remarks TEXT,
        batch_number VARCHAR(50),
        expiry_date DATE,
        sort_order INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
        batch_number VARCHAR(100) NOT NULL,
        expiry_date DATE,
        opening_quantity NUMERIC(12,3) NOT NULL,
        current_quantity NUMERIC(12,3) NOT NULL,
        grn_id UUID REFERENCES grn(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Fixing BILLING (Quick check)
    console.log('Final check on Billing modules...');
    await client.query(`
      ALTER TABLE ra_bills 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(200),
      ADD COLUMN IF NOT EXISTS contractor_gstin VARCHAR(15),
      ADD COLUMN IF NOT EXISTS contractor_pan VARCHAR(10);
    `);

    await client.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id),
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES users(id);
    `);

    // 4. Fixing FINANCE (Payments)
    console.log('Fixing Payments module...');
    await client.query(`
      ALTER TABLE payments 
      ADD COLUMN IF NOT EXISTS payment_type VARCHAR(30),
      ADD COLUMN IF NOT EXISTS entity_name VARCHAR(200),
      ADD COLUMN IF NOT EXISTS entity_pan VARCHAR(10),
      ADD COLUMN IF NOT EXISTS invoice_id UUID,
      ADD COLUMN IF NOT EXISTS tds_deducted NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount NUMERIC(15,2) DEFAULT 0;
    `);

    // 5. Fixing HR/PAYROLL
    console.log('Fixing HR & Payroll module...');
    await client.query(`
      ALTER TABLE workers 
      ADD COLUMN IF NOT EXISTS ot_rate NUMERIC(10,2) DEFAULT 0;

      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(4,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id);

      ALTER TABLE payroll 
      ADD COLUMN IF NOT EXISTS period_from DATE,
      ADD COLUMN IF NOT EXISTS period_to DATE,
      ADD COLUMN IF NOT EXISTS days_present NUMERIC(4,1) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS basic_wages NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ot_wages NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gross_wages NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pf_employee NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pf_employer NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS esi_employee NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS esi_employer NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_wages NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS payment_date DATE;
    `);

    // Add constraint for payroll uniqueness if missing
    try {
      await client.query(`ALTER TABLE payroll ADD CONSTRAINT unique_payroll_worker_period UNIQUE (worker_id, period_from, period_to)`);
    } catch(e) { /* ignore if exists */ }

    console.log('\n--- ALL MODULES SYNCHRONIZED SUCCESSFULLY ---');
  } catch (err) {
    console.error('\nFAIL:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
