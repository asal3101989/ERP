-- Migration: Forensic QA/QC Enhancements
-- Aligned with 'QA_QC Construction App — Feature Plan'

-- 1. Drawing Register (The Source of Truth)
CREATE TABLE IF NOT EXISTS quality_drawings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    drawing_number VARCHAR(100) NOT NULL, -- e.g. BR-S-GF-001
    title VARCHAR(255) NOT NULL,
    discipline VARCHAR(50), -- Structural, Arch, MEP
    revision VARCHAR(10) DEFAULT '0',
    status VARCHAR(50) DEFAULT 'issued_for_construction', -- ifc, for_approval, as_built
    file_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Material Submittals
CREATE TABLE IF NOT EXISTS quality_submittals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    submittal_number VARCHAR(100) NOT NULL, -- e.g. SUB-CONC-001
    material_name VARCHAR(255) NOT NULL,
    vendor_id UUID REFERENCES vendors(id),
    status VARCHAR(50) DEFAULT 'submitted', -- submitted, reviewed, approved, rejected
    approver_remarks TEXT,
    version INTEGER DEFAULT 1,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update Checklists (Add Discipline)
ALTER TABLE quality_checklists ADD COLUMN IF NOT EXISTS discipline VARCHAR(100);

-- 4. Update RFIs (Signatures & Drawing Links)
ALTER TABLE quality_rfis ADD COLUMN IF NOT EXISTS drawing_id UUID REFERENCES quality_drawings(id);
ALTER TABLE quality_rfis ADD COLUMN IF NOT EXISTS inspection_type VARCHAR(50) DEFAULT 'internal'; -- internal, client, joint
ALTER TABLE quality_rfis ADD COLUMN IF NOT EXISTS signatures JSONB DEFAULT '[]'::jsonb; -- [{ "role": "engineer", "name": "...", "sign_data": "...", "date": "..." }]

-- 5. Update NCRs (Forensic RCA & Severity)
ALTER TABLE quality_ncrs ADD COLUMN IF NOT EXISTS rca_method VARCHAR(50) DEFAULT '5-why';
ALTER TABLE quality_ncrs ADD COLUMN IF NOT EXISTS rca_details JSONB DEFAULT '{}'::jsonb; -- { "why1": "...", "why2": "...", "root_cause": "..." }
ALTER TABLE quality_ncrs ADD COLUMN IF NOT EXISTS evidence_before JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quality_ncrs ADD COLUMN IF NOT EXISTS evidence_after JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quality_ncrs ADD COLUMN IF NOT EXISTS resolution_deadline DATE;

-- 6. Forensic Lab Samples (Batches)
ALTER TABLE quality_lab_tests ADD COLUMN IF NOT EXISTS batch_id VARCHAR(100);
ALTER TABLE quality_lab_tests ADD COLUMN IF NOT EXISTS spec_reference TEXT; -- Reference to IS/ASTM code
