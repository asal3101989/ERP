process.chdir('H:\\OFFICE PROJECTS\\consrpro\\construct-erp\\backend');
require('dotenv').config();
const { pool } = require('./src/config/database');
async function run() {
  try {
    await pool.query(`
      DROP TABLE IF EXISTS drawings CASCADE;
      CREATE TABLE drawings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        drawing_number VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        discipline VARCHAR(100),
        revision VARCHAR(20) DEFAULT '0',
        status VARCHAR(50) DEFAULT 'Issued for Construction',
        issued_date DATE,
        scale VARCHAR(50),
        sheet_size VARCHAR(50),
        drawn_by VARCHAR(100),
        remarks TEXT,
        file_url TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      DROP TABLE IF EXISTS submittals CASCADE;
      CREATE TABLE submittals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        submittal_number VARCHAR(100) NOT NULL,
        submittal_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        spec_section VARCHAR(100),
        submitted_by VARCHAR(100),
        submitted_date DATE,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'Submitted',
        remarks TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DROP TABLE IF EXISTS meetings CASCADE;
      CREATE TABLE meetings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        meeting_number VARCHAR(100) NOT NULL,
        meeting_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        meeting_date DATE NOT NULL,
        meeting_time TIME,
        venue VARCHAR(255),
        minutes TEXT,
        attendees JSONB DEFAULT '[]',
        action_items JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'Scheduled',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Successfully created drawings, submittals, and meetings tables with UUID refs in construct_erp db');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
run();
