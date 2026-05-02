// backend/src/config/asset_upgrade_v1.js
const { pool, withTransaction } = require('./database');

async function upgradeAssets() {
  console.log('--- Starting Asset & Fleet System Upgrade (v1) ---');
  
  try {
    await withTransaction(async (client) => {
      // 1. Add modern columns to assets
      console.log('Adding operational telemetry columns to assets...');
      await client.query(`
        ALTER TABLE assets 
        ADD COLUMN IF NOT EXISTS meter_type TEXT DEFAULT 'Hours', -- Hours or Km
        ADD COLUMN IF NOT EXISTS current_meter DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS fuel_type TEXT DEFAULT 'Diesel',
        ADD COLUMN IF NOT EXISTS average_consumption_per_unit DECIMAL(10,2) DEFAULT 0, -- Liters per hour/km
        ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(15,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS next_service_meter DECIMAL(15,2) DEFAULT 0
      `);

      // 2. Create asset_fuel_logs table
      console.log('Creating asset_fuel_logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_fuel_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          company_id UUID REFERENCES companies(id),
          asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
          project_id UUID REFERENCES projects(id),
          log_date DATE DEFAULT CURRENT_DATE,
          quantity DECIMAL(10,2) NOT NULL, -- Liters
          rate_per_liter DECIMAL(10,2),
          total_cost DECIMAL(15,2),
          meter_at_log DECIMAL(15,2),
          issued_by UUID REFERENCES users(id),
          remarks TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 3. Create asset_usage_logs table
      console.log('Creating asset_usage_logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_usage_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          company_id UUID REFERENCES companies(id),
          asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
          project_id UUID REFERENCES projects(id),
          log_date DATE DEFAULT CURRENT_DATE,
          start_meter DECIMAL(15,2),
          end_meter DECIMAL(15,2),
          units_worked DECIMAL(10,2), -- Calculated: end - start
          operator_name TEXT,
          activity_name TEXT,
          remarks TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 4. Update existing assets with dummy meter types if missing
      await client.query(`UPDATE assets SET meter_type = 'Km' WHERE asset_type IN ('Tipper Truck', 'Water Tanker', 'Car', 'Pickup')`);
    });
    
    console.log('--- Asset & Fleet System Upgrade Completed Successfully ---');
  } catch (err) {
    console.error('Asset Upgrade Failed:', err);
    process.exit(1);
  }
}

upgradeAssets();
