// Run: node src/config/quality_migrate.js
require('dotenv').config();
const { pool } = require('./database');

const sql = `

CREATE TABLE IF NOT EXISTS quality_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  discipline VARCHAR(100),
  items JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  drawing_number VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  discipline VARCHAR(50),
  revision VARCHAR(10) DEFAULT '0',
  status VARCHAR(50) DEFAULT 'ifc',
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  submittal_number VARCHAR(100) NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  status VARCHAR(50) DEFAULT 'submitted',
  approver_remarks TEXT,
  version INTEGER DEFAULT 1,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rfi_number VARCHAR(50) UNIQUE NOT NULL,
  checklist_id UUID REFERENCES quality_checklists(id),
  drawing_id UUID REFERENCES quality_drawings(id),
  location VARCHAR(200),
  activity_name VARCHAR(255),
  scheduled_at TIMESTAMPTZ,
  inspection_type VARCHAR(50) DEFAULT 'internal',
  raised_by UUID REFERENCES users(id),
  inspected_by UUID REFERENCES users(id),
  inspected_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'raised',
  remarks TEXT,
  signatures JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_ncrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ncr_number VARCHAR(50) UNIQUE NOT NULL,
  rfi_id UUID REFERENCES quality_rfis(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'minor',
  raised_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  priority VARCHAR(20) DEFAULT 'medium',
  issue_type VARCHAR(50) DEFAULT 'quality',
  status VARCHAR(50) DEFAULT 'open',
  rca_method VARCHAR(50) DEFAULT '5-why',
  rca_details JSONB DEFAULT '{}'::jsonb,
  rectification_plan TEXT,
  resolution_deadline DATE,
  evidence_before JSONB DEFAULT '[]'::jsonb,
  evidence_after JSONB DEFAULT '[]'::jsonb,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  test_number VARCHAR(50) UNIQUE NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  test_name VARCHAR(255),
  lab_name VARCHAR(255),
  batch_id VARCHAR(100),
  spec_reference TEXT,
  request_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'pending',
  result TEXT,
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add attachments column if tables already exist
ALTER TABLE quality_rfis ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quality_ncrs ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quality_lab_tests ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_quality_rfis_project ON quality_rfis(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_ncrs_project ON quality_ncrs(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_lab_project ON quality_lab_tests(project_id);
CREATE INDEX IF NOT EXISTS idx_quality_checklists_company ON quality_checklists(company_id);

`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running quality module migration...');
    await client.query(sql);
    console.log('✅ Quality tables created successfully!');
  } catch (err) {
    console.error('❌ Quality migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
