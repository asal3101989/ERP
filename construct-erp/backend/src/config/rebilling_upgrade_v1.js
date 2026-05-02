// backend/src/config/rebilling_upgrade_v1.js
const { pool, withTransaction } = require('./database');

async function upgradeRevenueSystems() {
  console.log('--- Starting Project Revenue & Client Billing Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Upgrade ra_bills table
      console.log('Adding industrial-grade fiscal tracking to RA Bills...');
      await client.query(`
        ALTER TABLE ra_bills 
        ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'ra_bill', -- 'ra_bill', 'extra_item_bill', 'petty_cash'
        ADD COLUMN IF NOT EXISTS mobilization_advance_recovery_percent DECIMAL(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS retention_percent DECIMAL(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS security_deposit_percent DECIMAL(5,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS gst_percent DECIMAL(5,2) DEFAULT 18,
        ADD COLUMN IF NOT EXISTS certified_date DATE,
        ADD COLUMN IF NOT EXISTS client_bill_ref TEXT, -- External Bill No given by Client
        ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS certified_by_client_name TEXT
      `);

      // 2. Add 'Up to Previous' tracking columns to items
      console.log('Enhancing RA Bill items with cumulative history...');
      await client.query(`
        ALTER TABLE ra_bill_items
        ADD COLUMN IF NOT EXISTS previous_cumulative_qty DECIMAL(15,3) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS previous_cumulative_amount DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_certified_qty DECIMAL(15,3) DEFAULT 0
      `);

      // 3. Create a table for Extra items (Variations)
      console.log('Creating variations (Extra Items) schema...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS project_variations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID REFERENCES projects(id),
          description TEXT NOT NULL,
          unit TEXT NOT NULL,
          agreed_rate DECIMAL(15,2),
          status TEXT DEFAULT 'pending', -- pending, approved, included_in_boq
          created_by UUID REFERENCES users(id),
          approved_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
    });
    
    console.log('--- Revenue Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('Revenue Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradeRevenueSystems();
