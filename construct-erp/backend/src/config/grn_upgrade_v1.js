// backend/src/config/grn_upgrade_v1.js
const { pool, withTransaction } = require('./database');

async function upgradeGRN() {
  console.log('--- Starting Goods Receipt Note (GRN) System Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Add approval and formatting columns to grn table (singular)
      console.log('Adding multi-stage approval and doc format columns to grn...');
      await client.query(`
        ALTER TABLE grn 
        ADD COLUMN IF NOT EXISTS serial_no_formatted TEXT,
        ADD COLUMN IF NOT EXISTS gate_pass_no TEXT,
        ADD COLUMN IF NOT EXISTS wb_slip_no TEXT,
        ADD COLUMN IF NOT EXISTS verified_stores_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS verified_stores_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS approved_qc_by UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS approved_qc_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS po_id_link UUID REFERENCES purchase_orders(id),
        ADD COLUMN IF NOT EXISTS total_quantity DECIMAL(15,3) DEFAULT 0
      `);

      // 2. Create grn_items table
      console.log('Creating grn_items table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS grn_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          grn_id UUID REFERENCES grn(id) ON DELETE CASCADE,
          material_name TEXT NOT NULL,
          quantity_received DECIMAL(15,3) NOT NULL,
          unit TEXT NOT NULL,
          po_item_id UUID, -- Link to specific PO line if available
          quality_remarks TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 3. Migrate existing data (Move flat material info to grn_items)
      console.log('Migrating existing single-item GRN data to grn_items...');
      const existing = await client.query(`
        SELECT id, material_name, quantity_received, unit, quality_remarks, received_by, grn_date, quality_status
        FROM grn 
        WHERE id NOT IN (SELECT DISTINCT grn_id FROM grn_items)
      `);

      for (const row of existing.rows) {
        await client.query(`
          INSERT INTO grn_items (grn_id, material_name, quantity_received, unit, quality_remarks, sort_order)
          VALUES ($1, $2, $3, $4, $5, 1)
        `, [row.id, row.material_name, row.quantity_received, row.unit, row.quality_remarks]);
        
        // Update GRN header with totals and mark as auto-approved for legacy data
        // If status was 'approved' already, fill in signatures from received_by
        const isApproved = row.quality_status === 'approved';
        await client.query(`
          UPDATE grn 
          SET total_quantity = $1,
              verified_stores_by = $2,
              verified_stores_at = $3,
              approved_qc_by = $4,
              approved_qc_at = $5
          WHERE id = $6
        `, [
          row.quantity_received, 
          row.received_by, 
          row.grn_date, 
          isApproved ? row.received_by : null, 
          isApproved ? row.grn_date : null, 
          row.id
        ]);
      }

      console.log(`Successfully migrated ${existing.rows.length} existing GRNs.`);
    });
    
    console.log('--- GRN System Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('GRN Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradeGRN();
