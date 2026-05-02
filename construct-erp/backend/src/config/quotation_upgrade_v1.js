// backend/src/config/quotation_upgrade_v1.js
const { pool, withTransaction } = require('./database');

async function upgradeQuotation() {
  console.log('--- Starting Quotation & CS System Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Add CS and approval columns to material_indents
      console.log('Adding CS status and approval tracking to material_indents...');
      await client.query(`
        ALTER TABLE material_indents 
        ADD COLUMN IF NOT EXISTS cs_status TEXT DEFAULT 'pending_entry',
        ADD COLUMN IF NOT EXISTS cs_selected_vendor_id UUID REFERENCES vendors(id),
        ADD COLUMN IF NOT EXISTS cs_verified_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS cs_verified_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cs_checked_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS cs_checked_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS cs_approved_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS cs_approved_at TIMESTAMP
      `);

      // 2. Create quotation_items table for item-level rates
      console.log('Creating quotation_items table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS quotation_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
          indent_item_id UUID REFERENCES indent_items(id) ON DELETE CASCADE,
          rate DECIMAL(15,2) NOT NULL DEFAULT 0,
          discount_percent DECIMAL(5,2) DEFAULT 0,
          gst_rate DECIMAL(5,2) DEFAULT 18,
          remarks TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 3. Migrate existing header-level unit_rate to items (optional, but good for data integrity)
      console.log('Migrating legacy quotation rates to quotation_items...');
      const legacy = await client.query(`
        SELECT q.id, q.indent_id, q.unit_rate, q.gst_rate
        FROM quotations q
        WHERE q.id NOT IN (SELECT DISTINCT quotation_id FROM quotation_items)
      `);

      for (const q of legacy.rows) {
        // Find indent items for this quotation's indent
        const items = await client.query(`SELECT id FROM indent_items WHERE indent_id = $1`, [q.indent_id]);
        for (const it of items.rows) {
          await client.query(`
            INSERT INTO quotation_items (quotation_id, indent_item_id, rate, gst_rate)
            VALUES ($1, $2, $3, $4)
          `, [q.id, it.id, q.unit_rate || 0, q.gst_rate || 18]);
        }
      }

      console.log(`Migrated ${legacy.rows.length} legacy quotations.`);
    });
    
    console.log('--- Quotation/CS System Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('Quotation Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradeQuotation();
