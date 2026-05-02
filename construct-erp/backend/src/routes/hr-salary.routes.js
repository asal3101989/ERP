// src/routes/hr-salary.routes.js
// Salary structures, component templates, employee salary assignment
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// ─── Auto-create tables ───────────────────────────────────────────────────────
const initTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_salary_structures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id),
      name TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS hr_salary_components (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      structure_id UUID REFERENCES hr_salary_structures(id) ON DELETE CASCADE,
      component_name TEXT NOT NULL,
      component_type TEXT NOT NULL,
      calc_type TEXT DEFAULT 'fixed',
      amount NUMERIC(12,2) DEFAULT 0,
      pct NUMERIC(5,2) DEFAULT 0,
      is_taxable BOOLEAN DEFAULT TRUE,
      sort_order INT DEFAULT 0
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS hr_employee_salaries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      structure_id UUID REFERENCES hr_salary_structures(id),
      ctc_annual NUMERIC(14,2),
      basic NUMERIC(12,2),
      hra NUMERIC(12,2),
      conveyance NUMERIC(12,2),
      medical NUMERIC(12,2),
      special_allowance NUMERIC(12,2),
      other_allowance NUMERIC(12,2),
      gross_monthly NUMERIC(12,2),
      pf_applicable BOOLEAN DEFAULT TRUE,
      esi_applicable BOOLEAN DEFAULT TRUE,
      pt_applicable BOOLEAN DEFAULT TRUE,
      effective_from DATE NOT NULL,
      effective_to DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
initTables().catch(console.error);

// ═══════════════════════════════════════════════════════════
// SALARY STRUCTURES
// ═══════════════════════════════════════════════════════════
router.get('/structures', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, json_agg(c ORDER BY c.sort_order) FILTER (WHERE c.id IS NOT NULL) as components
       FROM hr_salary_structures s
       LEFT JOIN hr_salary_components c ON c.structure_id = s.id
       WHERE s.company_id = $1 AND s.is_active = TRUE
       GROUP BY s.id ORDER BY s.name`,
      [req.user.company_id]
    );
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/structures', async (req, res) => {
  const client = (await require('../config/database').pool.connect());
  try {
    await client.query('BEGIN');
    const { name, components = [] } = req.body;
    const { rows } = await client.query(
      `INSERT INTO hr_salary_structures (company_id, name) VALUES ($1,$2) RETURNING *`,
      [req.user.company_id, name]
    );
    const structure = rows[0];

    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      await client.query(
        `INSERT INTO hr_salary_components (structure_id, component_name, component_type, calc_type, amount, pct, is_taxable, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [structure.id, c.component_name, c.component_type, c.calc_type || 'fixed',
         c.amount || 0, c.pct || 0, c.is_taxable ?? true, i]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ data: structure });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put('/structures/:id', async (req, res) => {
  const client = (await require('../config/database').pool.connect());
  try {
    await client.query('BEGIN');
    const { name, is_active, components = [] } = req.body;
    const { rows } = await client.query(
      `UPDATE hr_salary_structures SET name=$1, is_active=$2 WHERE id=$3 AND company_id=$4 RETURNING *`,
      [name, is_active ?? true, req.params.id, req.user.company_id]
    );

    if (components.length) {
      await client.query(`DELETE FROM hr_salary_components WHERE structure_id=$1`, [req.params.id]);
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        await client.query(
          `INSERT INTO hr_salary_components (structure_id, component_name, component_type, calc_type, amount, pct, is_taxable, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [req.params.id, c.component_name, c.component_type, c.calc_type || 'fixed',
           c.amount || 0, c.pct || 0, c.is_taxable ?? true, i]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════
// EMPLOYEE SALARY ASSIGNMENT
// ═══════════════════════════════════════════════════════════
router.get('/employee-salaries', async (req, res) => {
  try {
    const { user_id } = req.query;
    let sql = `
      SELECT es.*, u.name as employee_name, u.employee_code, s.name as structure_name
      FROM hr_employee_salaries es
      JOIN users u ON u.id = es.user_id
      LEFT JOIN hr_salary_structures s ON s.id = es.structure_id
      WHERE u.company_id = $1`;
    const params = [req.user.company_id];
    if (user_id) { sql += ` AND es.user_id = $2`; params.push(user_id); }
    sql += ' ORDER BY es.effective_from DESC';
    const { rows } = await query(sql, params);
    res.json({ data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get current salary for a specific employee
router.get('/employee-salaries/:userId/current', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT es.*, s.name as structure_name
       FROM hr_employee_salaries es
       LEFT JOIN hr_salary_structures s ON s.id = es.structure_id
       WHERE es.user_id = $1 AND es.effective_from <= CURRENT_DATE
         AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)
       ORDER BY es.effective_from DESC LIMIT 1`,
      [req.params.userId]
    );
    res.json({ data: rows[0] || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/employee-salaries', async (req, res) => {
  try {
    const {
      user_id, structure_id, ctc_annual, basic, hra, conveyance, medical,
      special_allowance, other_allowance, gross_monthly,
      pf_applicable, esi_applicable, pt_applicable, effective_from, effective_to
    } = req.body;

    // Close any open salary record for this employee
    if (effective_from) {
      await query(
        `UPDATE hr_employee_salaries SET effective_to=$1
         WHERE user_id=$2 AND effective_to IS NULL AND effective_from < $1`,
        [effective_from, user_id]
      );
    }

    const { rows } = await query(
      `INSERT INTO hr_employee_salaries
       (user_id, structure_id, ctc_annual, basic, hra, conveyance, medical,
        special_allowance, other_allowance, gross_monthly,
        pf_applicable, esi_applicable, pt_applicable, effective_from, effective_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [user_id, structure_id || null, ctc_annual || null, basic || 0, hra || 0,
       conveyance || 0, medical || 0, special_allowance || 0, other_allowance || 0,
       gross_monthly || 0, pf_applicable ?? true, esi_applicable ?? true,
       pt_applicable ?? true, effective_from, effective_to || null]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
