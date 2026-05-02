// src/routes/payroll.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
router.use(authenticate);

// PF/ESI constants (India)
const PF_EMPLOYEE = 0.12;      // 12% of basic wages
const PF_EMPLOYER = 0.12;
const ESI_EMPLOYEE = 0.0075;   // 0.75%
const ESI_EMPLOYER = 0.0325;   // 3.25%
const PF_WAGE_CEILING = 15000; // PF applies on wages up to ₹15,000
const ESI_WAGE_CEILING = 21000; // ESI applies on wages up to ₹21,000

const calculatePayroll = (dailyRate, daysPresent, otHours, otRate) => {
  const basicWages  = dailyRate * daysPresent;
  const otWages     = (otRate || dailyRate * 2 / 8) * otHours;
  const grossWages  = basicWages + otWages;

  // PF on basic wages (capped at ₹15,000)
  const pfBase = Math.min(basicWages, PF_WAGE_CEILING);
  const pfEmployee = parseFloat((pfBase * PF_EMPLOYEE).toFixed(2));
  const pfEmployer = parseFloat((pfBase * PF_EMPLOYER).toFixed(2));

  // ESI on gross wages (if wage <= ₹21,000/month)
  const esiApplicable = grossWages <= ESI_WAGE_CEILING;
  const esiEmployee = esiApplicable ? parseFloat((grossWages * ESI_EMPLOYEE).toFixed(2)) : 0;
  const esiEmployer = esiApplicable ? parseFloat((grossWages * ESI_EMPLOYER).toFixed(2)) : 0;

  const netWages = parseFloat((grossWages - pfEmployee - esiEmployee).toFixed(2));

  return { basicWages: parseFloat(basicWages.toFixed(2)), otWages: parseFloat(otWages.toFixed(2)),
           grossWages: parseFloat(grossWages.toFixed(2)), pfEmployee, pfEmployer,
           esiEmployee, esiEmployer, netWages };
};

// GET payroll records
router.get('/', async (req, res) => {
  const { project_id, period_from, period_to, payment_status } = req.query;
  let sql = `SELECT pr.*,w.name as worker_name,w.skill_type,w.gang_name FROM payroll pr
             JOIN workers w ON pr.worker_id=w.id WHERE 1=1`;
  const params = []; let i=1;
  if (project_id)     { sql+=` AND pr.project_id=$${i++}`; params.push(project_id); }
  if (period_from)    { sql+=` AND pr.period_from>=$${i++}`; params.push(period_from); }
  if (period_to)      { sql+=` AND pr.period_to<=$${i++}`; params.push(period_to); }
  if (payment_status) { sql+=` AND pr.payment_status=$${i++}`; params.push(payment_status); }
  sql+=' ORDER BY pr.created_at DESC';
  const r = await query(sql, params);
  res.json({ data: r.rows });
});

// POST /payroll/generate — auto-generate from attendance
router.post('/generate', authorize('super_admin','admin','hr','accountant'), async (req, res) => {
  const { project_id, period_from, period_to } = req.body;

  const result = await withTransaction(async (client) => {
    // Get attendance summary
    const workers = await client.query(
      `SELECT w.id,w.daily_rate,w.ot_rate,
         COUNT(*) FILTER (WHERE a.status='present') as days_present,
         COUNT(*)*0.5 FILTER (WHERE a.status='half_day') as half_days,
         COALESCE(SUM(a.ot_hours),0) as ot_hours
       FROM workers w
       LEFT JOIN attendance a ON a.worker_id=w.id
         AND a.attendance_date BETWEEN $2 AND $3
       WHERE w.project_id=$1 AND w.is_active=true
       GROUP BY w.id,w.daily_rate,w.ot_rate`,
      [project_id, period_from, period_to]
    );

    const generated = [];
    for (const w of workers.rows) {
      const days = parseFloat(w.days_present) + parseFloat(w.half_days || 0);
      const calc = calculatePayroll(w.daily_rate, days, parseFloat(w.ot_hours), w.ot_rate);
      if (calc.grossWages === 0) continue;

      const r = await client.query(
        `INSERT INTO payroll (project_id,worker_id,period_from,period_to,days_present,ot_hours,
           basic_wages,ot_wages,gross_wages,pf_employee,pf_employer,esi_employee,esi_employer,net_wages,payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
         ON CONFLICT (worker_id, period_from, period_to) DO NOTHING RETURNING *`,
        [project_id,w.id,period_from,period_to,days,w.ot_hours,
         calc.basicWages,calc.otWages,calc.grossWages,
         calc.pfEmployee,calc.pfEmployer,calc.esiEmployee,calc.esiEmployer,calc.netWages]
      );
      if (r.rows[0]) generated.push(r.rows[0]);
    }
    return generated;
  });

  // Summary
  const totals = result.reduce((acc, r) => ({
    gross: acc.gross + parseFloat(r.gross_wages),
    pf_employee: acc.pf_employee + parseFloat(r.pf_employee),
    pf_employer: acc.pf_employer + parseFloat(r.pf_employer),
    esi_employee: acc.esi_employee + parseFloat(r.esi_employee),
    esi_employer: acc.esi_employer + parseFloat(r.esi_employer),
    net: acc.net + parseFloat(r.net_wages),
  }), { gross:0, pf_employee:0, pf_employer:0, esi_employee:0, esi_employer:0, net:0 });

  res.status(201).json({ message: `Payroll generated for ${result.length} workers`, data: result, totals });
});

// PATCH /payroll/:id/pay
router.patch('/:id/pay', authorize('super_admin','admin','accountant'), async (req, res) => {
  const { payment_mode, payment_date } = req.body;
  await query('UPDATE payroll SET payment_status=$1,payment_date=$2,payment_mode=$3 WHERE id=$4',
    ['paid', payment_date || new Date(), payment_mode || 'cash', req.params.id]);
  res.json({ message: 'Payment recorded' });
});

module.exports = router;
