// src/routes/hr-payroll.routes.js
// Monthly payroll: generate draft, review, approve, pay → Finance linkage
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

router.use(authenticate);

// ─── Auto-create table ────────────────────────────────────────────────────────
const initTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_monthly_payroll (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      user_id UUID REFERENCES users(id),
      month INT NOT NULL,
      year INT NOT NULL,
      working_days INT,
      paid_days NUMERIC(5,1),
      lop_days NUMERIC(5,1) DEFAULT 0,
      basic NUMERIC(12,2) DEFAULT 0,
      hra NUMERIC(12,2) DEFAULT 0,
      conveyance NUMERIC(12,2) DEFAULT 0,
      medical NUMERIC(12,2) DEFAULT 0,
      special_allowance NUMERIC(12,2) DEFAULT 0,
      other_earnings NUMERIC(12,2) DEFAULT 0,
      gross_earnings NUMERIC(12,2) DEFAULT 0,
      pf_employee NUMERIC(12,2) DEFAULT 0,
      pf_employer NUMERIC(12,2) DEFAULT 0,
      esi_employee NUMERIC(12,2) DEFAULT 0,
      esi_employer NUMERIC(12,2) DEFAULT 0,
      pt NUMERIC(12,2) DEFAULT 0,
      tds NUMERIC(12,2) DEFAULT 0,
      loan_deduction NUMERIC(12,2) DEFAULT 0,
      advance_deduction NUMERIC(12,2) DEFAULT 0,
      other_deductions NUMERIC(12,2) DEFAULT 0,
      total_deductions NUMERIC(12,2) DEFAULT 0,
      net_pay NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'draft',
      payment_date DATE,
      payment_mode TEXT,
      payment_ref TEXT,
      payslip_generated BOOLEAN DEFAULT FALSE,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, month, year)
    )
  `);
};
initTable().catch(console.error);

// ─── Statutory calc helpers ──────────────────────────────────────────────────
const PF_CEILING  = 15000;
const ESI_CEILING = 21000;
const PF_RATE_EMP = 0.12;
const PF_RATE_ER  = 0.12;
const ESI_RATE_EMP = 0.0075;
const ESI_RATE_ER  = 0.0325;

function calcPF(basic, applicable) {
  if (!applicable) return { emp: 0, er: 0 };
  const pfWage = Math.min(parseFloat(basic), PF_CEILING);
  return { emp: Math.round(pfWage * PF_RATE_EMP), er: Math.round(pfWage * PF_RATE_ER) };
}

function calcESI(gross, applicable) {
  if (!applicable || parseFloat(gross) > ESI_CEILING) return { emp: 0, er: 0 };
  return {
    emp: Math.round(parseFloat(gross) * ESI_RATE_EMP),
    er:  Math.round(parseFloat(gross) * ESI_RATE_ER),
  };
}

// Professional Tax — Maharashtra slab (configurable per state)
function calcPT(gross, month, applicable) {
  if (!applicable) return 0;
  const g = parseFloat(gross);
  if (g <= 7500) return 0;
  // Feb = 300, rest = 200 (Maharashtra default)
  if (g <= 10000) return month === 2 ? 300 : 175;
  return month === 2 ? 300 : 200;
}

// Working days in a month (Mon–Sat)
function workingDaysInMonth(month, year) {
  const days = new Date(year, month, 0).getDate(); // total days
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const wd = new Date(year, month - 1, d).getDay();
    if (wd !== 0) count++; // exclude Sundays
  }
  return count;
}

// ═══════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { month, year, status, user_id } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year)  || new Date().getFullYear();

    let sql = `
      SELECT p.*, u.name as employee_name, u.employee_code,
             dep.name as department_name, des.name as designation_name
      FROM hr_monthly_payroll p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN employee_profiles ep ON ep.user_id = u.id
      LEFT JOIN hr_departments dep ON dep.id = ep.department_id
      LEFT JOIN hr_designations des ON des.id = ep.designation_id
      WHERE p.company_id = $1 AND p.month = $2 AND p.year = $3`;
    const params = [req.user.company_id, m, y];
    let idx = 4;

    if (status)  { sql += ` AND p.status=$${idx}`;  params.push(status);  idx++; }
    if (user_id) { sql += ` AND p.user_id=$${idx}`; params.push(user_id); idx++; }

    sql += ' ORDER BY u.name';
    const { rows } = await query(sql, params);

    // Summary totals
    const totals = rows.reduce((acc, r) => ({
      gross_earnings:   acc.gross_earnings   + parseFloat(r.gross_earnings || 0),
      total_deductions: acc.total_deductions + parseFloat(r.total_deductions || 0),
      net_pay:          acc.net_pay          + parseFloat(r.net_pay || 0),
      pf_employer:      acc.pf_employer      + parseFloat(r.pf_employer || 0),
    }), { gross_earnings: 0, total_deductions: 0, net_pay: 0, pf_employer: 0 });

    res.json({ data: rows, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// GET SINGLE (payslip data)
// ═══════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name as employee_name, u.employee_code, u.email,
              ep.pan_number, ep.uan_number, ep.bank_name, ep.bank_account_number, ep.bank_ifsc,
              ep.date_of_joining, dep.name as department_name, des.name as designation_name
       FROM hr_monthly_payroll p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       LEFT JOIN hr_departments dep ON dep.id = ep.department_id
       LEFT JOIN hr_designations des ON des.id = ep.designation_id
       WHERE p.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Payroll record not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// GENERATE PAYROLL (POST /run)
// ═══════════════════════════════════════════════════════════
router.post('/run', async (req, res) => {
  try {
    const { month, year } = req.body;
    const m = parseInt(month);
    const y = parseInt(year);
    const workDays = workingDaysInMonth(m, y);

    // Get all active employees with salary
    const employees = await query(
      `SELECT u.id as user_id,
              es.basic, es.hra, es.conveyance, es.medical,
              es.special_allowance, es.other_allowance, es.gross_monthly,
              es.pf_applicable, es.esi_applicable, es.pt_applicable
       FROM users u
       JOIN hr_employee_salaries es ON es.user_id = u.id
         AND es.effective_from <= make_date($3,$1,1)
         AND (es.effective_to IS NULL OR es.effective_to >= make_date($3,$1,1))
       WHERE u.company_id = $2 AND u.is_active = TRUE`,
      [m, req.user.company_id, y]
    );

    const generated = [];
    for (const emp of employees.rows) {
      // Count attendance for the month
      const att = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status='present')  as present,
           COUNT(*) FILTER (WHERE status='half_day') as half_day,
           COUNT(*) FILTER (WHERE status='absent')   as absent,
           COUNT(*) FILTER (WHERE status='leave')    as on_leave
         FROM hr_attendance
         WHERE user_id=$1
           AND EXTRACT(MONTH FROM attendance_date)=$2
           AND EXTRACT(YEAR  FROM attendance_date)=$3`,
        [emp.user_id, m, y]
      );
      const a = att.rows[0];
      const paidDays = parseFloat(a.present || 0) + parseFloat(a.half_day || 0) * 0.5 + parseFloat(a.on_leave || 0);
      const lopDays  = workDays - paidDays;

      // Pro-rate salary if LOP
      const lopFactor = workDays > 0 ? paidDays / workDays : 1;
      const basic = Math.round(parseFloat(emp.basic || 0) * lopFactor);
      const hra   = Math.round(parseFloat(emp.hra   || 0) * lopFactor);
      const conv  = Math.round(parseFloat(emp.conveyance || 0) * lopFactor);
      const med   = Math.round(parseFloat(emp.medical || 0) * lopFactor);
      const spec  = Math.round(parseFloat(emp.special_allowance || 0) * lopFactor);
      const other = Math.round(parseFloat(emp.other_allowance || 0) * lopFactor);
      const gross = basic + hra + conv + med + spec + other;

      // Statutory deductions
      const pf  = calcPF(basic, emp.pf_applicable);
      const esi = calcESI(gross, emp.esi_applicable);
      const pt  = calcPT(gross, m, emp.pt_applicable);

      // Loan deduction (active loans)
      const loanQ = await query(
        `SELECT COALESCE(SUM(emi_amount),0) as total_emi
         FROM hr_loans WHERE user_id=$1 AND status='approved' AND balance_amount>0`,
        [emp.user_id]
      );
      const loanDed = parseFloat(loanQ.rows[0].total_emi || 0);

      const totalDed = pf.emp + esi.emp + pt + loanDed;
      const netPay   = gross - totalDed;

      // Upsert payroll record (skip if already approved/paid)
      const existing = await query(
        `SELECT id, status FROM hr_monthly_payroll WHERE user_id=$1 AND month=$2 AND year=$3`,
        [emp.user_id, m, y]
      );
      if (existing.rows.length && ['approved','paid'].includes(existing.rows[0].status)) {
        generated.push({ user_id: emp.user_id, skipped: true, status: existing.rows[0].status });
        continue;
      }

      const { rows } = await query(
        `INSERT INTO hr_monthly_payroll
         (company_id, user_id, month, year, working_days, paid_days, lop_days,
          basic, hra, conveyance, medical, special_allowance, gross_earnings,
          pf_employee, pf_employer, esi_employee, esi_employer, pt, loan_deduction,
          total_deductions, net_pay)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (user_id, month, year) DO UPDATE SET
           working_days=$5, paid_days=$6, lop_days=$7,
           basic=$8, hra=$9, conveyance=$10, medical=$11, special_allowance=$12, gross_earnings=$13,
           pf_employee=$14, pf_employer=$15, esi_employee=$16, esi_employer=$17, pt=$18,
           loan_deduction=$19, total_deductions=$20, net_pay=$21, status='draft'
         RETURNING *`,
        [req.user.company_id, emp.user_id, m, y, workDays, paidDays, Math.max(0, lopDays),
         basic, hra, conv, med, spec, gross,
         pf.emp, pf.er, esi.emp, esi.er, pt, loanDed,
         totalDed, netPay]
      );
      generated.push(rows[0]);
    }

    res.status(201).json({ data: generated, count: generated.length, month: m, year: y });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// UPDATE (edit TDS / other deductions before approval)
// ═══════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const { tds, other_deductions, loan_deduction, advance_deduction, remarks } = req.body;
    const existing = await query(`SELECT * FROM hr_monthly_payroll WHERE id=$1`, [req.params.id]);
    const p = existing.rows[0];
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (p.status !== 'draft') return res.status(400).json({ error: 'Can only edit draft payroll' });

    const totalDed = parseFloat(p.pf_employee) + parseFloat(p.esi_employee) + parseFloat(p.pt) +
                     parseFloat(loan_deduction ?? p.loan_deduction) + parseFloat(advance_deduction ?? p.advance_deduction) +
                     parseFloat(tds ?? p.tds) + parseFloat(other_deductions ?? p.other_deductions);
    const netPay = parseFloat(p.gross_earnings) - totalDed;

    const { rows } = await query(
      `UPDATE hr_monthly_payroll
       SET tds=$1, other_deductions=$2, loan_deduction=$3, advance_deduction=$4,
           total_deductions=$5, net_pay=$6, remarks=$7
       WHERE id=$8 AND company_id=$9 RETURNING *`,
      [tds ?? p.tds, other_deductions ?? p.other_deductions, loan_deduction ?? p.loan_deduction,
       advance_deduction ?? p.advance_deduction, totalDed, netPay, remarks ?? p.remarks,
       req.params.id, req.user.company_id]
    );
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// APPROVE single
// ═══════════════════════════════════════════════════════════
router.patch('/:id/approve', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE hr_monthly_payroll SET status='approved'
       WHERE id=$1 AND company_id=$2 AND status='draft' RETURNING *`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Cannot approve — already approved or not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// BULK PAY — mark month as paid + create Finance payment records
// ═══════════════════════════════════════════════════════════
router.post('/bulk-pay', async (req, res) => {
  try {
    const { month, year, payment_date, payment_mode, payment_ref } = req.body;
    const m = parseInt(month);
    const y = parseInt(year);

    // Get all approved payroll records for this month
    const approved = await query(
      `SELECT p.*, u.name as employee_name
       FROM hr_monthly_payroll p JOIN users u ON u.id = p.user_id
       WHERE p.company_id=$1 AND p.month=$2 AND p.year=$3 AND p.status='approved'`,
      [req.user.company_id, m, y]
    );

    if (!approved.rows.length) {
      return res.status(400).json({ error: 'No approved payroll records for this month' });
    }

    const results = [];
    for (const p of approved.rows) {
      // Mark payroll as paid
      await query(
        `UPDATE hr_monthly_payroll SET status='paid', payment_date=$1, payment_mode=$2, payment_ref=$3
         WHERE id=$4`,
        [payment_date, payment_mode || 'bank_transfer', payment_ref || null, p.id]
      );

      // Auto-create Finance payment record
      try {
        await query(
          `INSERT INTO payments (company_id, project_id, entity_name, amount, tds_deducted, net_amount,
             payment_date, payment_mode, source, remarks)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'hr_payroll', $8)`,
          [req.user.company_id, p.employee_name,
           p.gross_earnings, p.tds, p.net_pay,
           payment_date, payment_mode || 'bank_transfer',
           `Salary ${new Date(y, m-1).toLocaleString('default',{month:'long'})} ${y}`]
        );
      } catch (e) {
        // Don't fail the whole batch if payments table schema differs
        console.warn('Finance payment insert skipped:', e.message);
      }
      results.push({ id: p.id, employee_name: p.employee_name, net_pay: p.net_pay });
    }

    res.json({ data: results, count: results.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// PAYSLIP HTML (for print page)
// ═══════════════════════════════════════════════════════════
router.get('/:id/payslip', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name as employee_name, u.employee_code, u.email,
              ep.pan_number, ep.uan_number, ep.bank_name, ep.bank_account_number, ep.bank_ifsc,
              ep.date_of_joining, dep.name as department_name, des.name as designation_name,
              c.name as company_name
       FROM hr_monthly_payroll p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       LEFT JOIN hr_departments dep ON dep.id = ep.department_id
       LEFT JOIN hr_designations des ON des.id = ep.designation_id
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Payroll not found' });
    res.json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// STATUTORY REPORTS
// ═══════════════════════════════════════════════════════════

// PF ECR (EPFO format)
router.get('/reports/pf-ecr', async (req, res) => {
  try {
    const { month, year } = req.query;
    const { rows } = await query(
      `SELECT u.name, ep.uan_number, ep.pf_account_number,
              p.basic, p.pf_employee, p.pf_employer,
              (p.pf_employee + p.pf_employer) as total_pf
       FROM hr_monthly_payroll p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       WHERE p.company_id=$1 AND p.month=$2 AND p.year=$3 AND p.status IN ('approved','paid')
       ORDER BY u.name`,
      [req.user.company_id, month, year]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ESI Return
router.get('/reports/esi-return', async (req, res) => {
  try {
    const { month, year } = req.query;
    const { rows } = await query(
      `SELECT u.name, ep.esi_number,
              p.gross_earnings, p.esi_employee, p.esi_employer,
              (p.esi_employee + p.esi_employer) as total_esi
       FROM hr_monthly_payroll p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       WHERE p.company_id=$1 AND p.month=$2 AND p.year=$3
         AND p.esi_employee > 0 AND p.status IN ('approved','paid')
       ORDER BY u.name`,
      [req.user.company_id, month, year]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Headcount report
router.get('/reports/headcount', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT dep.name as department,
              COUNT(u.id) as total,
              COUNT(u.id) FILTER (WHERE ep.employment_status='active')     as active,
              COUNT(u.id) FILTER (WHERE ep.employment_status='resigned')   as resigned,
              COUNT(u.id) FILTER (WHERE ep.employment_type='permanent')    as permanent,
              COUNT(u.id) FILTER (WHERE ep.employment_type='contract')     as contract,
              COUNT(u.id) FILTER (WHERE ep.employment_type='probation')    as probation
       FROM users u
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       LEFT JOIN hr_departments dep ON dep.id = ep.department_id
       WHERE u.company_id = $1
       GROUP BY dep.name ORDER BY dep.name`,
      [req.user.company_id]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
