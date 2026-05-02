// backend/src/config/invoice_upgrade_v1.js
const { pool, withTransaction } = require('./database');

async function upgradeInvoices() {
  console.log('--- Starting Vendor Billing & Payables Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Upgrade invoices table
      console.log('Adding 3-way match and tax logic to invoices...');
      await client.query(`
        ALTER TABLE invoices 
        ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES purchase_orders(id),
        ADD COLUMN IF NOT EXISTS grn_id UUID REFERENCES grn(id),
        ADD COLUMN IF NOT EXISTS tax_details JSONB, -- { igst, cgst, sgst, tds_percent, tds_amount }
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS authorized_by UUID REFERENCES users(id)
      `);

      // 2. Create invoice_items table for line-level reconciliation
      console.log('Creating invoice_items table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
          material_name TEXT NOT NULL,
          unit TEXT,
          quantity_on_grn DECIMAL(15,2),
          quantity_invoiced DECIMAL(15,2),
          rate_on_po DECIMAL(15,2),
          rate_invoiced DECIMAL(15,2),
          tax_percent DECIMAL(5,2),
          tax_amount DECIMAL(15,2),
          net_amount DECIMAL(15,2),
          sort_order INT
        )
      `);

      // 3. Update existing invoices to 'verified' (historical data)
      await client.query(`UPDATE invoices SET status = 'verified' WHERE status = 'pending'`);
    });
    
    console.log('--- Billing Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('Billing Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradeInvoices();
