// backend/src/config/min_upgrade_v1.js
const { pool, withTransaction } = require('./database');

async function upgradeMIN() {
  console.log('--- Starting Material Issue Note (MIN) System Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Add modern columns to material_issue_notes
      console.log('Adding site-specific logistics and status to material_issue_notes...');
      await client.query(`
        ALTER TABLE material_issue_notes 
        ADD COLUMN IF NOT EXISTS activity_name TEXT,
        ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES vendors(id),
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS verified_receiver_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS verified_receiver_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS verified_receiver_sig TEXT,
        ADD COLUMN IF NOT EXISTS serial_no_formatted TEXT
      `);

      // 2. Initialize existing MINs to 'issued' status (historical data)
      console.log('Finalizing historical MIN statuses...');
      await client.query(`UPDATE material_issue_notes SET status = 'issued' WHERE status IS NULL OR status = 'draft'`);

      // 3. Create a helper table for MIN digital signatures if needed (using sig column for now)
    });
    
    console.log('--- MIN System Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('MIN Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradeMIN();
