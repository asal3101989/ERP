// backend/src/config/po_upgrade_v1.js
const { query, withTransaction } = require('./database');

async function upgradePO() {
  console.log('--- Starting Purchase Order System Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Add approval and formatting columns to purchase_orders
      console.log('Adding multi-stage approval and doc format columns...');
      await client.query(`
        ALTER TABLE purchase_orders 
        ADD COLUMN IF NOT EXISTS serial_no_formatted TEXT,
        ADD COLUMN IF NOT EXISTS sub_total DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_gst DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS verified_procurement_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS verified_procurement_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS checked_finance_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS checked_finance_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS released_mgmt_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS released_mgmt_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS authorized_md_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS authorized_md_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS bank_details TEXT
      `);

      // 2. Create po_items table
      console.log('Creating po_items table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS po_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
          material_name TEXT NOT NULL,
          hsn_code TEXT,
          quantity DECIMAL(15,3) NOT NULL,
          unit TEXT NOT NULL,
          rate DECIMAL(15,2) NOT NULL,
          gst_rate DECIMAL(5,2) DEFAULT 18.0,
          gst_amount DECIMAL(15,2) DEFAULT 0,
          total_amount DECIMAL(15,2) DEFAULT 0,
          purpose TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 3. Migrate existing data (Move flat material info to po_items)
      console.log('Migrating existing single-item PO data to po_items...');
      const existing = await client.query(`
        SELECT id, material_name, hsn_code, quantity, unit, rate, gst_rate, gst_amount, total_value 
        FROM purchase_orders 
        WHERE id NOT IN (SELECT DISTINCT po_id FROM po_items)
      `);

      for (const po of existing.rows) {
        await client.query(`
          INSERT INTO po_items (po_id, material_name, hsn_code, quantity, unit, rate, gst_rate, gst_amount, total_amount, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
        `, [po.id, po.material_name, po.hsn_code, po.quantity, po.unit, po.rate, po.gst_rate, po.gst_amount, po.total_value]);
        
        // Update PO header with migrated totals
        await client.query(`
          UPDATE purchase_orders 
          SET sub_total = $1, total_gst = $2, grand_total = $3 
          WHERE id = $4
        `, [po.quantity * po.rate, po.gst_amount, po.total_value, po.id]);
      }

      console.log(`Successfully migrated ${existing.rows.length} existing POs.`);
    });
    
    console.log('--- PO System Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('PO Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradePO();
