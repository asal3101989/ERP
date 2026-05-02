// backend/src/config/mrs_upgrade_v2.js
require('dotenv').config();
const { pool } = require('./database');

const sql = `
-- 1. Add signature to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- 2. Expand material_requisitions for 6-stage workflow
ALTER TABLE material_requisitions 
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS head_office_project_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS serial_no_formatted VARCHAR(50),
  
  -- Stage 2: Tower Manager
  ADD COLUMN IF NOT EXISTS verified_tower_mgr_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_tower_mgr_at TIMESTAMPTZ,
  
  -- Stage 3: Project Manager
  ADD COLUMN IF NOT EXISTS approved_pm_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_pm_at TIMESTAMPTZ,
  
  -- Stage 4: Sr. Project Manager
  ADD COLUMN IF NOT EXISTS approved_sr_pm_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_sr_pm_at TIMESTAMPTZ,
  
  -- Stage 5: Management (Director)
  ADD COLUMN IF NOT EXISTS approved_mgmt_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_mgmt_at TIMESTAMPTZ,
  
  -- Stage 6: Management (MD)
  ADD COLUMN IF NOT EXISTS approved_md_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_md_at TIMESTAMPTZ,
  
  -- Purchase Dept Section
  ADD COLUMN IF NOT EXISTS purchase_received_date DATE,
  ADD COLUMN IF NOT EXISTS po_no_date VARCHAR(100),
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

-- 3. Update status check constraint (Drop and recreate)
ALTER TABLE material_requisitions DROP CONSTRAINT IF EXISTS material_requisitions_status_check;
ALTER TABLE material_requisitions ADD CONSTRAINT material_requisitions_status_check 
  CHECK (status IN ('draft', 'pending', 'verified_tower', 'approved_pm', 'approved_srpm', 'approved_mgmt', 'approved_md', 'issued', 'rejected'));
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Upgrading MRS table for 6-stage legacy workflow...');
    await client.query(sql);
    console.log('✅ MRS table upgraded successfully!');
  } catch (err) {
    console.error('❌ Upgrade failed:', err.message);
  } finally {
    client.release();
    process.exit();
  }
}

run();
