// backend/src/config/subcontractor_upgrade_v1.js
const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const schema = `
-- 1. Subcontractor Work Orders (Contracts)
-- status: draft, active, approved, closed, disputed
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    wo_number VARCHAR(50) UNIQUE NOT NULL,
    wo_date DATE DEFAULT CURRENT_DATE,
    subject TEXT,
    scope_of_work TEXT,
    start_date DATE,
    end_date DATE,
    total_value NUMERIC(15,2) DEFAULT 0,
    terms_conditions TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Backfill columns for existing tables (safe to run multiple times)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS scope_of_work TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- Normalise: ensure both old (work_description/contract_amount) and new (subject/total_value) names exist
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS total_value NUMERIC(15,2) DEFAULT 0;
-- Copy data from old columns to new ones where new ones are empty
UPDATE work_orders SET subject     = work_description WHERE subject IS NULL AND work_description IS NOT NULL;
UPDATE work_orders SET total_value = contract_amount   WHERE total_value = 0  AND contract_amount IS NOT NULL AND contract_amount > 0;

CREATE TABLE IF NOT EXISTS work_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    unit VARCHAR(20),
    quantity NUMERIC(15,3) NOT NULL,
    rate NUMERIC(15,2) NOT NULL,
    amount NUMERIC(15,2) GENERATED ALWAYS AS (quantity * rate) STORED,
    remarks TEXT
);

-- 2. Subcontractor Measurement Book (Work Progress)
-- status: pending, verified, billed
-- wo_item_id is nullable to support free-text measurements from the simplified form
CREATE TABLE IF NOT EXISTS subcontractor_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    wo_item_id UUID REFERENCES work_order_items(id) ON DELETE SET NULL,
    measurement_date DATE DEFAULT CURRENT_DATE,
    quantity NUMERIC(15,3) NOT NULL,
    item_description TEXT,
    unit VARCHAR(20),
    rate NUMERIC(15,2),
    remarks TEXT,
    location_details TEXT,
    photo_evidence TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id)
);

-- Backfill new measurement columns for existing tables
ALTER TABLE subcontractor_measurements ALTER COLUMN wo_item_id DROP NOT NULL;
ALTER TABLE subcontractor_measurements ADD COLUMN IF NOT EXISTS item_description TEXT;
ALTER TABLE subcontractor_measurements ADD COLUMN IF NOT EXISTS unit VARCHAR(20);
ALTER TABLE subcontractor_measurements ADD COLUMN IF NOT EXISTS rate NUMERIC(15,2);
ALTER TABLE subcontractor_measurements ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 3. Subcontractor RA Bills (Payments)
-- status: pending, submitted, approved, paid
CREATE TABLE IF NOT EXISTS subcontractor_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    wo_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    bill_date DATE DEFAULT CURRENT_DATE,
    period_start DATE,
    period_end DATE,
    due_date DATE,

    -- Primary amounts (simplified model)
    bill_amount NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    retention_percent NUMERIC(5,2) DEFAULT 0,

    -- Detailed deductions (advanced model)
    gross_amount NUMERIC(15,2) DEFAULT 0,
    tds_pct NUMERIC(5,2) DEFAULT 2.0,
    tds_amount NUMERIC(15,2) DEFAULT 0,
    retention_pct NUMERIC(5,2) DEFAULT 5.0,
    retention_amount NUMERIC(15,2) DEFAULT 0,
    security_pct NUMERIC(5,2) DEFAULT 5.0,
    security_amount NUMERIC(15,2) DEFAULT 0,
    advance_recovery NUMERIC(15,2) DEFAULT 0,
    other_deductions NUMERIC(15,2) DEFAULT 0,

    net_payable NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    remarks TEXT,

    -- Payment tracking
    payment_date DATE,
    payment_ref TEXT,
    payment_mode TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill new bill columns for existing tables
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS retention_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS payment_date DATE;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE subcontractor_bills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS subcontractor_bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID REFERENCES subcontractor_bills(id) ON DELETE CASCADE,
    wo_item_id UUID REFERENCES work_order_items(id) ON DELETE CASCADE,
    measurement_id UUID REFERENCES subcontractor_measurements(id) ON DELETE CASCADE,
    billed_qty NUMERIC(15,3) NOT NULL,
    rate NUMERIC(15,2) NOT NULL,
    amount NUMERIC(15,2) NOT NULL
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_wo_project ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_wo_vendor ON work_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_mb_wo ON subcontractor_measurements(wo_id);
CREATE INDEX IF NOT EXISTS idx_sub_bill_wo ON subcontractor_bills(wo_id);
`;

async function upgrade() {
  await client.connect();
  try {
    console.log('Deploying Subcontractor Billing Schema...');
    await client.query(schema);
    console.log('Success: Subcontractor tables deployed successfully.');
  } catch (err) {
    console.error('Error deploying schema:', err);
  } finally {
    await client.end();
  }
}

upgrade();
