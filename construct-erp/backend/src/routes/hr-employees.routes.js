// src/routes/hr-employees.routes.js
// Employee CRUD + extended profile + documents
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// ─── Multer setup ─────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/hr-docs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auto-create tables ───────────────────────────────────────────────────────
const initTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS employee_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      company_id UUID REFERENCES companies(id),
      department_id UUID REFERENCES hr_departments(id),
      designation_id UUID REFERENCES hr_designations(id),
      date_of_joining DATE,
      date_of_birth DATE,
      gender TEXT,
      father_name TEXT,
      mother_name TEXT,
      marital_status TEXT,
      blood_group TEXT,
      nationality TEXT DEFAULT 'Indian',
      pan_number TEXT,
      aadhaar_number TEXT,
      uan_number TEXT,
      pf_account_number TEXT,
      esi_number TEXT,
      bank_name TEXT,
      bank_account_number TEXT,
      bank_ifsc TEXT,
      permanent_address TEXT,
      current_address TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      employment_type TEXT DEFAULT 'permanent',
      probation_end_date DATE,
      notice_period_days INT DEFAULT 30,
      date_of_leaving DATE,
      leaving_reason TEXT,
      employment_status TEXT DEFAULT 'active',
      profile_photo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      doc_name TEXT,
      file_url TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      uploaded_by UUID REFERENCES users(id)
    )
  `);
};
initTables().catch(console.error);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const employeeSelect = `
  SELECT u.id, u.employee_code, u.name, u.email, u.phone, u.role, u.designation,
         u.department, u.is_active,
         ep.department_id, ep.designation_id, ep.date_of_joining, ep.date_of_birth,
         ep.gender, ep.father_name, ep.mother_name, ep.marital_status, ep.blood_group,
         ep.nationality, ep.pan_number, ep.aadhaar_number, ep.uan_number,
         ep.pf_account_number, ep.esi_number, ep.bank_name, ep.bank_account_number,
         ep.bank_ifsc, ep.permanent_address, ep.current_address,
         ep.emergency_contact_name, ep.emergency_contact_phone,
         ep.employment_type, ep.probation_end_date, ep.notice_period_days,
         ep.date_of_leaving, ep.leaving_reason, ep.employment_status, ep.profile_photo_url,
         dep.name as department_name, des.name as designation_name, des.grade
  FROM users u
  LEFT JOIN employee_profiles ep ON ep.user_id = u.id
  LEFT JOIN hr_departments dep ON dep.id = ep.department_id
  LEFT JOIN hr_designations des ON des.id = ep.designation_id
`;

// ═══════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { search, department_id, employment_status, employment_type } = req.query;
    let sql = `${employeeSelect} WHERE u.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;

    if (search) {
      sql += ` AND (u.name ILIKE $${idx} OR u.employee_code ILIKE $${idx} OR u.email ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (department_id) {
      sql += ` AND ep.department_id = $${idx}`;
      params.push(department_id); idx++;
    }
    if (employment_status) {
      sql += ` AND ep.employment_status = $${idx}`;
      params.push(employment_status); idx++;
    }
    if (employment_type) {
      sql += ` AND ep.employment_type = $${idx}`;
      params.push(employment_type); idx++;
    }
    sql += ' ORDER BY u.name';

    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// GET SINGLE (with documents)
// ═══════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `${employeeSelect} WHERE u.id = $1 AND u.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });

    const docs = await query(
      `SELECT * FROM employee_documents WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [req.params.id]
    );
    res.json({ data: { ...rows[0], documents: docs.rows } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// CREATE (user + profile together)
// ═══════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  const client = (await require('../config/database').pool.connect());
  try {
    await client.query('BEGIN');

    const {
      // User fields
      name, email, phone, role, employee_code,
      // Profile fields
      department_id, designation_id, date_of_joining, date_of_birth, gender,
      father_name, mother_name, marital_status, blood_group, nationality,
      pan_number, aadhaar_number, uan_number, pf_account_number, esi_number,
      bank_name, bank_account_number, bank_ifsc,
      permanent_address, current_address,
      emergency_contact_name, emergency_contact_phone,
      employment_type, probation_end_date, notice_period_days,
    } = req.body;

    // Generate employee code if not provided
    const code = employee_code || await generateEmpCode(req.user.company_id);

    // Create user with a temporary password (emp code as password, they should change)
    const bcrypt = require('bcrypt');
    const tempPassword = await bcrypt.hash(code, 10);

    // Get dept/desig names for denormalized user fields
    let deptName = '', desigName = '';
    if (department_id) {
      const dr = await client.query(`SELECT name FROM hr_departments WHERE id=$1`, [department_id]);
      deptName = dr.rows[0]?.name || '';
    }
    if (designation_id) {
      const dr = await client.query(`SELECT name FROM hr_designations WHERE id=$1`, [designation_id]);
      desigName = dr.rows[0]?.name || '';
    }

    const userRes = await client.query(
      `INSERT INTO users (company_id, employee_code, name, email, phone, role, designation, department, password_hash, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) RETURNING id`,
      [req.user.company_id, code, name, email, phone || null,
       role || 'viewer', desigName, deptName, tempPassword]
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO employee_profiles
       (user_id, company_id, department_id, designation_id, date_of_joining, date_of_birth,
        gender, father_name, mother_name, marital_status, blood_group, nationality,
        pan_number, aadhaar_number, uan_number, pf_account_number, esi_number,
        bank_name, bank_account_number, bank_ifsc, permanent_address, current_address,
        emergency_contact_name, emergency_contact_phone, employment_type,
        probation_end_date, notice_period_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
      [userId, req.user.company_id, department_id || null, designation_id || null,
       date_of_joining || null, date_of_birth || null, gender || null,
       father_name || null, mother_name || null, marital_status || null,
       blood_group || null, nationality || 'Indian', pan_number || null,
       aadhaar_number || null, uan_number || null, pf_account_number || null,
       esi_number || null, bank_name || null, bank_account_number || null,
       bank_ifsc || null, permanent_address || null, current_address || null,
       emergency_contact_name || null, emergency_contact_phone || null,
       employment_type || 'permanent', probation_end_date || null,
       notice_period_days || 30]
    );

    await client.query('COMMIT');

    // Return full employee record
    const { rows } = await query(`${employeeSelect} WHERE u.id = $1`, [userId]);
    res.status(201).json({ data: rows[0], temp_password: code });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'Employee with this email or code already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════
// UPDATE PROFILE
// ═══════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  const client = (await require('../config/database').pool.connect());
  try {
    await client.query('BEGIN');

    const {
      name, email, phone, role,
      department_id, designation_id, date_of_joining, date_of_birth, gender,
      father_name, mother_name, marital_status, blood_group, nationality,
      pan_number, aadhaar_number, uan_number, pf_account_number, esi_number,
      bank_name, bank_account_number, bank_ifsc, permanent_address, current_address,
      emergency_contact_name, emergency_contact_phone, employment_type,
      probation_end_date, notice_period_days,
    } = req.body;

    let deptName = '', desigName = '';
    if (department_id) {
      const dr = await client.query(`SELECT name FROM hr_departments WHERE id=$1`, [department_id]);
      deptName = dr.rows[0]?.name || '';
    }
    if (designation_id) {
      const dr = await client.query(`SELECT name FROM hr_designations WHERE id=$1`, [designation_id]);
      desigName = dr.rows[0]?.name || '';
    }

    await client.query(
      `UPDATE users SET name=$1, email=$2, phone=$3, role=$4, designation=$5, department=$6
       WHERE id=$7 AND company_id=$8`,
      [name, email, phone || null, role || 'viewer', desigName, deptName,
       req.params.id, req.user.company_id]
    );

    await client.query(
      `INSERT INTO employee_profiles
       (user_id, company_id, department_id, designation_id, date_of_joining, date_of_birth,
        gender, father_name, mother_name, marital_status, blood_group, nationality,
        pan_number, aadhaar_number, uan_number, pf_account_number, esi_number,
        bank_name, bank_account_number, bank_ifsc, permanent_address, current_address,
        emergency_contact_name, emergency_contact_phone, employment_type,
        probation_end_date, notice_period_days, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         department_id=$3, designation_id=$4, date_of_joining=$5, date_of_birth=$6,
         gender=$7, father_name=$8, mother_name=$9, marital_status=$10, blood_group=$11,
         nationality=$12, pan_number=$13, aadhaar_number=$14, uan_number=$15,
         pf_account_number=$16, esi_number=$17, bank_name=$18, bank_account_number=$19,
         bank_ifsc=$20, permanent_address=$21, current_address=$22,
         emergency_contact_name=$23, emergency_contact_phone=$24, employment_type=$25,
         probation_end_date=$26, notice_period_days=$27, updated_at=NOW()`,
      [req.params.id, req.user.company_id, department_id || null, designation_id || null,
       date_of_joining || null, date_of_birth || null, gender || null,
       father_name || null, mother_name || null, marital_status || null,
       blood_group || null, nationality || 'Indian', pan_number || null,
       aadhaar_number || null, uan_number || null, pf_account_number || null,
       esi_number || null, bank_name || null, bank_account_number || null,
       bank_ifsc || null, permanent_address || null, current_address || null,
       emergency_contact_name || null, emergency_contact_phone || null,
       employment_type || 'permanent', probation_end_date || null, notice_period_days || 30]
    );

    await client.query('COMMIT');
    const { rows } = await query(`${employeeSelect} WHERE u.id = $1`, [req.params.id]);
    res.json({ data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════
// UPDATE STATUS (exit / terminate etc)
// ═══════════════════════════════════════════════════════════
router.patch('/:id/status', async (req, res) => {
  try {
    const { employment_status, date_of_leaving, leaving_reason, is_active } = req.body;
    await query(
      `UPDATE employee_profiles SET employment_status=$1, date_of_leaving=$2, leaving_reason=$3, updated_at=NOW()
       WHERE user_id=$4 AND company_id=$5`,
      [employment_status, date_of_leaving || null, leaving_reason || null,
       req.params.id, req.user.company_id]
    );
    if (is_active !== undefined) {
      await query(`UPDATE users SET is_active=$1 WHERE id=$2 AND company_id=$3`,
        [is_active, req.params.id, req.user.company_id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTS
// ═══════════════════════════════════════════════════════════
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  try {
    const { doc_type, doc_name } = req.body;
    const fileUrl = req.file ? `/uploads/hr-docs/${req.file.filename}` : req.body.file_url;
    const { rows } = await query(
      `INSERT INTO employee_documents (user_id, doc_type, doc_name, file_url, uploaded_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, doc_type, doc_name || req.file?.originalname, fileUrl, req.user.id]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM employee_documents WHERE id=$1 AND user_id=$2 RETURNING file_url`,
      [req.params.docId, req.params.id]
    );
    if (rows[0]?.file_url) {
      const fp = path.join(__dirname, '../..', rows[0].file_url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Helper: generate employee code ─────────────────────────────────────────
async function generateEmpCode(companyId) {
  const yr = new Date().getFullYear().toString().slice(-2);
  const { rows } = await query(
    `SELECT COUNT(*) as cnt FROM users WHERE company_id=$1`, [companyId]
  );
  const seq = String(parseInt(rows[0].cnt) + 1).padStart(3, '0');
  return `EMP${yr}${seq}`;
}

module.exports = router;
