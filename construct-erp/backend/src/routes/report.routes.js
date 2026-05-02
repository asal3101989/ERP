// src/routes/report.routes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
router.use(authenticate);

async function ensureProjectOwnership(projectId, companyId) {
  const check = await query(
    `SELECT 1 FROM projects WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [projectId, companyId]
  );
  return check.rowCount > 0;
}

// Project Profitability P&L
router.get('/profitability', async (req, res) => {
  const { year } = req.query;
  const { project_id } = req.query;
  const params = [req.user.company_id];
  let projectFilter = '';
  if (project_id) {
    projectFilter = ' AND p.id = $2';
    params.push(project_id);
  }
  const r = await query(
    `SELECT p.id, p.name, p.type, p.contract_value, p.status,
       COALESCE((SELECT SUM(i.total_amount) FROM invoices i WHERE i.project_id=p.id AND i.payment_status='paid'),0) as revenue_collected,
       COALESCE((SELECT SUM(b.actual_amount) FROM budget_items b WHERE b.project_id=p.id),0) as total_cost,
       COALESCE((SELECT SUM(b.budgeted_amount) FROM budget_items b WHERE b.project_id=p.id),0) as total_budget,
       COALESCE((SELECT SUM(rb.net_payable) FROM ra_bills rb WHERE rb.project_id=p.id AND rb.status IN ('certified','paid')),0) as certified_amount
     FROM projects p WHERE p.company_id=$1 AND p.is_active=true${projectFilter}
     ORDER BY p.contract_value DESC`,
    params
  );
  const data = r.rows.map(p => ({
    ...p,
    gross_profit: parseFloat(p.revenue_collected) - parseFloat(p.total_cost),
    margin_pct: parseFloat(p.revenue_collected) > 0
      ? (((parseFloat(p.revenue_collected) - parseFloat(p.total_cost)) / parseFloat(p.revenue_collected)) * 100).toFixed(1)
      : 0
  }));
  res.json({ data });
});

// GST Report
router.get('/gst', async (req, res) => {
  try {
    const { year, quarter } = req.query;
    const yr = parseInt(year) || new Date().getFullYear();

    let gstSql = `SELECT gst_type,
       SUM(taxable_amount) as taxable,
       SUM(cgst_amount) as cgst,
       SUM(sgst_amount) as sgst,
       SUM(igst_amount) as igst,
       SUM(cgst_amount+sgst_amount+igst_amount) as total_gst,
       COUNT(*) as invoice_count
     FROM invoices i JOIN projects p ON i.project_id=p.id
     WHERE p.company_id=$1 AND EXTRACT(YEAR FROM i.invoice_date)=$2`;
    const gstParams = [req.user.company_id, yr];
    if (quarter) {
      gstSql += ` AND EXTRACT(QUARTER FROM i.invoice_date) = $3`;
      gstParams.push(parseInt(quarter));
    }
    gstSql += ' GROUP BY gst_type';

    const output = await query(gstSql, gstParams);
    const itc = await query(
      `SELECT COALESCE(SUM(gst_amount),0) as total_itc FROM purchase_orders po
       JOIN projects p ON po.project_id=p.id
       WHERE p.company_id=$1 AND EXTRACT(YEAR FROM po.po_date)=$2 AND po.status!='cancelled'`,
      [req.user.company_id, yr]
    );
    const total_output = output.rows.reduce((s,r) => s + parseFloat(r.total_gst||0), 0);
    const total_itc = parseFloat(itc.rows[0].total_itc||0);
    res.json({ output: output.rows, itc: itc.rows[0], net_payable: (total_output - total_itc).toFixed(2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TDS Report (Form 26Q)
router.get('/tds', async (req, res) => {
  try {
    const { year, from_date, to_date, from, to } = req.query;
    const dateFrom = from_date || from;
    const dateTo   = to_date   || to;

    let whereClauses = [`p.company_id = $1`, `pay.tds_deducted > 0`];
    const params = [req.user.company_id];
    let idx = 2;

    if (dateFrom && dateTo) {
      whereClauses.push(`pay.payment_date BETWEEN $${idx++} AND $${idx++}`);
      params.push(dateFrom, dateTo);
    } else {
      // default: current financial year
      const yr = parseInt(year) || new Date().getFullYear();
      whereClauses.push(`EXTRACT(YEAR FROM pay.payment_date) = $${idx++}`);
      params.push(yr);
    }

    const r = await query(
      `SELECT entity_name, entity_pan,
         SUM(amount)       AS gross_paid,
         SUM(tds_deducted) AS tds_amount,
         COUNT(*)          AS transactions
       FROM payments pay
       JOIN projects p ON pay.project_id = p.id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY entity_name, entity_pan
       ORDER BY tds_amount DESC`,
      params
    );
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vendor Ledger (TQS + Finance)
router.get('/vendor-ledger', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (project_id && !(await ensureProjectOwnership(project_id, req.user.company_id))) {
      return res.status(400).json({ error: 'Invalid project for this company' });
    }

    const params = [req.user.company_id];
    let idx = 2;
    const projectClauseTqs = project_id ? ` AND b.project_id = $${idx}` : '';
    const projectClauseInv = project_id ? ` AND i.project_id = $${idx}` : '';
    const projectClausePay = project_id ? ` AND pay.project_id = $${idx}` : '';
    if (project_id) params.push(project_id);

    const [tqsRes, invRes, payRes] = await Promise.all([
      query(
        `
          SELECT
            COALESCE(b.vendor_id::text, 'name:' || COALESCE(b.vendor_name, 'unknown')) AS vendor_key,
            b.vendor_id,
            b.vendor_name,
            COUNT(b.id)::int AS bill_count,
            COALESCE(SUM(b.total_amount), 0) AS total_invoiced,
            COALESCE(SUM(u.certified_net), 0) AS total_certified,
            COALESCE(SUM(u.paid_amount), 0) AS total_paid,
            COALESCE(SUM(u.tds_deduction), 0) AS total_tds,
            COALESCE(SUM(u.retention_money), 0) AS total_retention,
            COALESCE(SUM(u.certified_net), 0) - COALESCE(SUM(u.paid_amount), 0) AS outstanding,
            'TQS' AS source
          FROM tqs_bills b
          LEFT JOIN tqs_bill_updates u ON u.bill_id = b.id
          LEFT JOIN projects p ON p.id = b.project_id
          WHERE b.company_id = $1 AND b.is_deleted = FALSE ${projectClauseTqs}
          GROUP BY COALESCE(b.vendor_id::text, 'name:' || COALESCE(b.vendor_name, 'unknown')), b.vendor_id, b.vendor_name
        `,
        params
      ),
      query(
        `
          SELECT
            COALESCE(i.vendor_id::text, 'name:' || COALESCE(v.name, 'unknown')) AS vendor_key,
            i.vendor_id,
            COALESCE(v.name, 'unknown') AS vendor_name,
            COUNT(i.id)::int AS bill_count,
            COALESCE(SUM(COALESCE(i.net_amount, i.total_amount, 0)), 0) AS total_invoiced,
            0::numeric AS total_certified,
            COALESCE(SUM(COALESCE(pay_sum.paid_amount, 0)), 0) AS total_paid,
            0::numeric AS total_tds,
            0::numeric AS total_retention,
            COALESCE(SUM(GREATEST(COALESCE(i.net_amount, i.total_amount, 0) - COALESCE(pay_sum.paid_amount, 0), 0)), 0) AS outstanding,
            'Finance' AS source
          FROM invoices i
          JOIN projects p ON p.id = i.project_id
          JOIN vendors v ON v.id = i.vendor_id
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(pay.net_amount), 0) AS paid_amount
            FROM payments pay
            WHERE pay.invoice_id = i.id
          ) pay_sum ON TRUE
          WHERE p.company_id = $1 ${projectClauseInv}
          GROUP BY COALESCE(i.vendor_id::text, 'name:' || COALESCE(v.name, 'unknown')), i.vendor_id, v.name
        `,
        params
      ),
      query(
        `
          SELECT
            COALESCE(i.vendor_id::text, 'name:' || COALESCE(pay.entity_name, 'unknown')) AS vendor_key,
            i.vendor_id,
            COALESCE(v.name, pay.entity_name, 'unknown') AS vendor_name,
            COUNT(pay.id)::int AS bill_count,
            0::numeric AS total_invoiced,
            0::numeric AS total_certified,
            COALESCE(SUM(pay.net_amount), 0) AS total_paid,
            COALESCE(SUM(pay.tds_deducted), 0) AS total_tds,
            0::numeric AS total_retention,
            0::numeric AS outstanding,
            'Payment' AS source
          FROM payments pay
          JOIN projects p ON p.id = pay.project_id
          LEFT JOIN invoices i ON i.id = pay.invoice_id
          LEFT JOIN vendors v ON v.id = i.vendor_id
          WHERE p.company_id = $1 ${projectClausePay}
          GROUP BY COALESCE(i.vendor_id::text, 'name:' || COALESCE(pay.entity_name, 'unknown')), i.vendor_id, COALESCE(v.name, pay.entity_name, 'unknown')
        `,
        params
      ),
    ]);

    const map = new Map();
    const merge = (row) => {
      const key = row.vendor_key;
      if (!map.has(key)) {
        map.set(key, {
          vendor_key: key,
          vendor_id: row.vendor_id || null,
          vendor_name: row.vendor_name || '—',
          bill_count: 0,
          total_invoiced: 0,
          total_certified: 0,
          total_paid: 0,
          total_tds: 0,
          total_retention: 0,
          outstanding: 0,
          sources: new Set(),
        });
      }
      const target = map.get(key);
      target.vendor_id = target.vendor_id || row.vendor_id || null;
      target.vendor_name = target.vendor_name !== '—' ? target.vendor_name : (row.vendor_name || '—');
      target.bill_count += Number(row.bill_count || 0);
      target.total_invoiced += Number(row.total_invoiced || 0);
      target.total_certified += Number(row.total_certified || 0);
      target.total_paid += Number(row.total_paid || 0);
      target.total_tds += Number(row.total_tds || 0);
      target.total_retention += Number(row.total_retention || 0);
      target.outstanding += Number(row.outstanding || 0);
      target.sources.add(row.source);
    };

    [...tqsRes.rows, ...invRes.rows, ...payRes.rows].forEach(merge);

    const data = [...map.values()]
      .map(row => ({
        ...row,
        sources: [...row.sources].sort().join(' + '),
      }))
      .sort((a, b) => b.outstanding - a.outstanding || a.vendor_name.localeCompare(b.vendor_name));

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BOQ vs Actual
router.get('/boq-actual', async (req, res) => {
  const { project_id } = req.query;
  if (!await ensureProjectOwnership(project_id, req.user.company_id)) {
    return res.status(400).json({ error: 'Invalid project for this company' });
  }
  const r = await query(
    `SELECT b.item_no, b.description, b.unit,
       b.quantity as contract_qty, b.rate, b.amount as contract_value,
       COALESCE((SELECT SUM(m.net_quantity) FROM measurements m JOIN projects pm ON m.project_id = pm.id WHERE m.boq_item_id=b.id AND m.status='pm_approved' AND pm.company_id=$2),0) as executed_qty,
       COALESCE((SELECT SUM(rbi.current_qty) FROM ra_bill_items rbi JOIN ra_bills rb ON rbi.ra_bill_id=rb.id JOIN projects rp ON rb.project_id = rp.id WHERE rbi.boq_item_id=b.id AND rb.status IN ('certified','paid') AND rp.company_id=$2),0) as certified_qty
     FROM boq_items b JOIN projects p ON b.project_id = p.id WHERE b.project_id=$1 AND p.company_id=$2 AND b.is_active=true ORDER BY b.chapter_no,b.item_no`,
    [project_id, req.user.company_id]
  );
  const data = r.rows.map(row => ({
    ...row,
    executed_value: (parseFloat(row.executed_qty) * parseFloat(row.rate)).toFixed(2),
    balance_qty: (parseFloat(row.contract_qty) - parseFloat(row.executed_qty)).toFixed(3),
    pct_complete: parseFloat(row.contract_qty) > 0
      ? ((parseFloat(row.executed_qty) / parseFloat(row.contract_qty)) * 100).toFixed(1) : 0
  }));
  res.json({ data });
});

// Labour Productivity
router.get('/labor', async (req, res) => {
  const { project_id, from_date, to_date } = req.query;
  if (!await ensureProjectOwnership(project_id, req.user.company_id)) {
    return res.status(400).json({ error: 'Invalid project for this company' });
  }
  const r = await query(
    `SELECT w.skill_type,
       COUNT(DISTINCT w.id) as worker_count,
       SUM(CASE WHEN a.status='present' THEN 1 WHEN a.status='half_day' THEN 0.5 ELSE 0 END) as man_days,
       SUM(a.ot_hours) as ot_hours,
       SUM(w.daily_rate * CASE WHEN a.status='present' THEN 1 WHEN a.status='half_day' THEN 0.5 ELSE 0 END) as wage_cost
     FROM workers w
     JOIN projects p ON w.project_id = p.id
     LEFT JOIN attendance a ON a.worker_id=w.id
       AND a.attendance_date BETWEEN $2 AND $3
     WHERE w.project_id=$1 AND p.company_id=$4 GROUP BY w.skill_type ORDER BY wage_cost DESC`,
    [project_id, from_date || '2024-01-01', to_date || new Date().toISOString().split('T')[0], req.user.company_id]
  );
  res.json({ data: r.rows });
});

// Stock Report
router.get('/stock', async (req, res) => {
  const { project_id } = req.query;
  if (!await ensureProjectOwnership(project_id, req.user.company_id)) {
    return res.status(400).json({ error: 'Invalid project for this company' });
  }
  const r = await query(
    `SELECT i.*,
       CASE WHEN i.closing_stock < i.minimum_level THEN 'LOW' ELSE 'OK' END as stock_status
     FROM inventory i
     JOIN projects p ON i.project_id = p.id
     WHERE i.project_id=$1 AND p.company_id=$2 ORDER BY i.material_name`,
    [project_id, req.user.company_id]
  );
  res.json({ data: r.rows });
});

// Safety KPI Report
router.get('/safety', async (req, res) => {
  const { year } = req.query;
  const yr = year || new Date().getFullYear();
  const r = await query(
    `SELECT p.name as project_name,
       COUNT(i.id) as total_incidents,
       COUNT(i.id) FILTER (WHERE i.incident_type='near_miss') as near_miss,
       COUNT(i.id) FILTER (WHERE i.incident_type='minor_injury') as minor_injury,
       COUNT(i.id) FILTER (WHERE i.incident_type='major_accident') as major_accident,
       SUM(i.lost_time_days) as lti_days,
       COUNT(i.id) FILTER (WHERE i.status='open') as open_incidents
     FROM projects p LEFT JOIN incidents i ON i.project_id=p.id
       AND EXTRACT(YEAR FROM i.incident_date)=$2
     WHERE p.company_id=$1 GROUP BY p.id,p.name`,
    [req.user.company_id, yr]
  );
  res.json({ data: r.rows });
});

// ── GET /reports/project-pl ────────────────────────────────────────────────
// Full project P&L: Contract Value → Client Billing → TQS Vendor Cost → Margin
router.get('/project-pl', async (req, res) => {
  try {
    const { project_id } = req.query;
    let where = `p.company_id = $1 AND p.is_active = TRUE`;
    const params = [req.user.company_id];
    if (project_id) { where += ` AND p.id = $2`; params.push(project_id); }

    const { rows } = await query(`
      SELECT
        p.id,
        p.name                                AS project_name,
        p.type                                AS project_type,
        p.status,
        COALESCE(p.contract_value, 0)         AS contract_value,

        -- Client Revenue (RA Bills billed to client)
        COALESCE(rev.gross_billed,    0)      AS gross_billed,
        COALESCE(rev.net_billed,      0)      AS net_billed,
        COALESCE(rev.received,        0)      AS received_from_client,
        COALESCE(rev.bill_count,      0)      AS ra_bill_count,

        -- Vendor Cost (TQS certified amounts)
        COALESCE(cost.vendor_certified, 0)    AS vendor_certified,
        COALESCE(cost.vendor_paid,      0)    AS vendor_paid,
        COALESCE(cost.vendor_outstanding, 0)  AS vendor_outstanding,
        COALESCE(cost.tds_held,         0)    AS tds_held,
        COALESCE(cost.retention_held,   0)    AS retention_held,
        COALESCE(cost.bill_count,       0)    AS tqs_bill_count,

        -- Other Payments (labour, overhead etc from payments table)
        COALESCE(pay.other_cost,        0)    AS other_cost,

        -- Computed P&L
        COALESCE(rev.net_billed, 0) -
          COALESCE(cost.vendor_certified, 0) -
          COALESCE(pay.other_cost, 0)         AS gross_margin,

        CASE WHEN COALESCE(rev.net_billed, 0) > 0
          THEN ROUND(
            (COALESCE(rev.net_billed, 0) -
             COALESCE(cost.vendor_certified, 0) -
             COALESCE(pay.other_cost, 0))
            / COALESCE(rev.net_billed, 0) * 100, 1)
          ELSE 0
        END                                   AS margin_pct,

        -- % of contract billed
        CASE WHEN COALESCE(p.contract_value, 0) > 0
          THEN ROUND(COALESCE(rev.net_billed, 0) / p.contract_value * 100, 1)
          ELSE 0
        END                                   AS pct_billed

      FROM projects p

      LEFT JOIN LATERAL (
        SELECT
          SUM(rb.gross_amount)  FILTER (WHERE rb.status IN ('certified','paid')) AS gross_billed,
          SUM(rb.net_payable)   FILTER (WHERE rb.status IN ('certified','paid')) AS net_billed,
          SUM(rb.net_payable)   FILTER (WHERE rb.status = 'paid')               AS received,
          COUNT(rb.id)          FILTER (WHERE rb.status IN ('certified','paid')) AS bill_count
        FROM ra_bills rb WHERE rb.project_id = p.id
      ) rev ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          SUM(u.certified_net)    AS vendor_certified,
          SUM(u.paid_amount)      AS vendor_paid,
          SUM(u.balance_to_pay)   AS vendor_outstanding,
          SUM(u.tds_deduction)    AS tds_held,
          SUM(u.retention_money)  AS retention_held,
          COUNT(tb.id)            AS bill_count
        FROM tqs_bills tb
        LEFT JOIN tqs_bill_updates u ON u.bill_id = tb.id
        WHERE tb.project_id = p.id AND tb.is_deleted = FALSE
          AND tb.workflow_status IN ('qs','accounts','paid')
      ) cost ON TRUE

      LEFT JOIN LATERAL (
        SELECT SUM(pay.net_amount) AS other_cost
        FROM payments pay
        WHERE pay.project_id = p.id
          AND pay.source != 'tqs'   -- exclude TQS auto-entries (already in vendor_certified)
      ) pay ON TRUE

      WHERE ${where}
      ORDER BY COALESCE(p.contract_value, 0) DESC
    `, params);

    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
