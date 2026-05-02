// src/controllers/raBill.controller.js
const { query, withTransaction } = require('../config/database');

// Calculate RA Bill totals
const calculateRaBill = (data) => {
  const {
    gross_amount, gst_rate = 18,
    retention_pct = 5,
    mobilization_advance_recovery = 0,
    material_recovery_total = 0,
    delay_penalty = 0,
    other_deductions = 0,
    tds_rate = 2
  } = data;

  const gst_amount = parseFloat(((gross_amount * gst_rate) / 100).toFixed(2));
  const gross_with_gst = parseFloat((gross_amount + gst_amount).toFixed(2));
  const retention_amount = parseFloat(((gross_amount * retention_pct) / 100).toFixed(2));
  const tds_amount = parseFloat(((gross_amount * tds_rate) / 100).toFixed(2));

  const total_deductions = parseFloat((
    retention_amount +
    parseFloat(mobilization_advance_recovery) +
    parseFloat(material_recovery_total) +
    parseFloat(delay_penalty) +
    parseFloat(other_deductions) +
    tds_amount
  ).toFixed(2));

  const net_payable = parseFloat((gross_with_gst - total_deductions).toFixed(2));

  return {
    gst_amount, gross_with_gst, retention_amount, tds_amount,
    total_deductions, net_payable
  };
};

// POST /api/v1/ra-bills
const createRaBill = async (req, res) => {
  try {
    const {
      project_id, bill_number, bill_date, contractor_name,
      contractor_gstin, contractor_pan, work_description,
      bill_period_from, bill_period_to,
      items,  // [{boq_item_id, prev_certified_qty, current_qty, rate}]
      retention_pct, mobilization_advance_recovery,
      material_recovery_total,
      delay_penalty, other_deductions, tds_rate, remarks
    } = req.body;

    // Calculate gross from items
    const gross_amount = items.reduce((sum, item) =>
      sum + (parseFloat(item.current_qty) * parseFloat(item.rate)), 0
    );

    const calc = calculateRaBill({
      gross_amount, gst_rate: 18,
      retention_pct, mobilization_advance_recovery,
      material_recovery_total,
      delay_penalty, other_deductions, tds_rate
    });

    const result = await withTransaction(async (client) => {
      // Insert bill
      const billRes = await client.query(
        `INSERT INTO ra_bills (
          project_id, bill_number, bill_date, contractor_name,
          contractor_gstin, contractor_pan, work_description,
          bill_period_from, bill_period_to,
          gross_amount, gst_rate, gst_amount, gross_with_gst,
          retention_pct, retention_amount,
          mobilization_advance_recovery,
          material_recovery_total,
          delay_penalty, other_deductions,
          tds_rate, tds_amount, total_deductions, net_payable,
          remarks, submitted_by, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'submitted')
        RETURNING *`,
        [
          project_id, bill_number, bill_date, contractor_name,
          contractor_gstin, contractor_pan, work_description,
          bill_period_from, bill_period_to,
          gross_amount, 18, calc.gst_amount, calc.gross_with_gst,
          retention_pct || 5, calc.retention_amount,
          mobilization_advance_recovery || 0,
          material_recovery_total || 0,
          delay_penalty || 0, other_deductions || 0,
          tds_rate || 2, calc.tds_amount, calc.total_deductions, calc.net_payable,
          remarks, req.user.id
        ]
      );
      const bill = billRes.rows[0];

      // Insert bill items
      for (const item of items) {
        const cumulative = parseFloat(item.prev_certified_qty || 0) + parseFloat(item.current_qty);
        await client.query(
          `INSERT INTO ra_bill_items (ra_bill_id, boq_item_id, prev_certified_qty, current_qty, cumulative_qty, rate)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [bill.id, item.boq_item_id, item.prev_certified_qty || 0, item.current_qty, cumulative, item.rate]
        );
      }
      return bill;
    });

    res.status(201).json({ message: 'RA Bill created successfully.', data: result, calculation: calc });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bill number already exists.' });
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/v1/ra-bills/:id/approve — Approval workflow
const approveBill = async (req, res) => {
  try {
    const { action, remarks } = req.body;  // action: approve | reject
    const bill = await query('SELECT * FROM ra_bills WHERE id = $1', [req.params.id]);
    if (!bill.rows[0]) return res.status(404).json({ error: 'Bill not found.' });

    const b = bill.rows[0];
    const role = req.user.role;

    // Reject flow — any authorized role can reject at their stage
    if (action === 'reject') {
      const allowedRejectStages = {
        'qs_engineer':     ['submitted'],
        'project_manager': ['qs_review', 'pm_approval'],
        'accountant':      ['accounts_verify'],
        'admin':           ['submitted', 'qs_review', 'pm_approval', 'accounts_verify'],
        'super_admin':     ['submitted', 'qs_review', 'pm_approval', 'accounts_verify'],
      };
      const stages = allowedRejectStages[role];
      if (!stages || !stages.includes(b.status)) {
        return res.status(400).json({ error: `Cannot reject. Bill is in '${b.status}' status and your role is '${role}'.` });
      }
      await query('UPDATE ra_bills SET status = $1, remarks = $2, updated_at = NOW() WHERE id = $3',
        ['rejected', remarks || 'Rejected', req.params.id]);
      return res.json({ message: 'Bill rejected.' });
    }

    // Approve flow — strict role → status transitions
    // Full chain: submitted → qs_review → pm_approval → accounts_verify → certified
    const transitions = {
      'qs_engineer': [
        { from: 'submitted', to: 'qs_review', field: 'qs_approved_by', time: 'qs_approved_at' },
      ],
      'project_manager': [
        { from: 'qs_review',   to: 'pm_approval',     field: 'pm_approved_by', time: 'pm_approved_at' },
      ],
      'accountant': [
        { from: 'accounts_verify', to: 'certified', field: 'accounts_approved_by', time: 'accounts_approved_at' },
      ],
      'admin': [
        { from: 'submitted',       to: 'qs_review',        field: 'qs_approved_by',       time: 'qs_approved_at' },
        { from: 'qs_review',       to: 'pm_approval',      field: 'pm_approved_by',       time: 'pm_approved_at' },
        { from: 'pm_approval',     to: 'accounts_verify',  field: 'pm_approved_by',       time: 'pm_approved_at' },
        { from: 'accounts_verify', to: 'certified',        field: 'accounts_approved_by', time: 'accounts_approved_at' },
      ],
      'super_admin': [
        { from: 'submitted',       to: 'qs_review',        field: 'qs_approved_by',       time: 'qs_approved_at' },
        { from: 'qs_review',       to: 'pm_approval',      field: 'pm_approved_by',       time: 'pm_approved_at' },
        { from: 'pm_approval',     to: 'accounts_verify',  field: 'pm_approved_by',       time: 'pm_approved_at' },
        { from: 'accounts_verify', to: 'certified',        field: 'accounts_approved_by', time: 'accounts_approved_at' },
      ],
    };

    const roleTransitions = transitions[role];
    if (!roleTransitions) return res.status(403).json({ error: 'Your role cannot approve bills.' });

    const transition = roleTransitions.find(t => t.from === b.status);
    if (!transition) {
      return res.status(400).json({ error: `Cannot approve. Bill is in '${b.status}' status — not actionable by '${role}'.` });
    }

    await query(
      `UPDATE ra_bills SET status = $1, ${transition.field} = $2, ${transition.time} = NOW(), updated_at = NOW() WHERE id = $3`,
      [transition.to, req.user.id, req.params.id]
    );

    res.json({ message: `Bill approved. Status: ${transition.to}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/ra-bills — with filters
const getRaBills = async (req, res) => {
  try {
    const { project_id, status, contractor } = req.query;
    let sql = `SELECT rb.*, p.name as project_name,
                u1.name as submitted_by_name,
                u2.name as qs_approved_by_name,
                u3.name as pm_approved_by_name
               FROM ra_bills rb
               JOIN projects p ON rb.project_id = p.id
               LEFT JOIN users u1 ON rb.submitted_by = u1.id
               LEFT JOIN users u2 ON rb.qs_approved_by = u2.id
               LEFT JOIN users u3 ON rb.pm_approved_by = u3.id
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;

    if (project_id) { sql += ` AND rb.project_id = $${idx++}`; params.push(project_id); }
    if (status) { sql += ` AND rb.status = $${idx++}`; params.push(status); }
    if (contractor) { sql += ` AND rb.contractor_name ILIKE $${idx++}`; params.push(`%${contractor}%`); }

    sql += ' ORDER BY rb.bill_date DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createRaBill, approveBill, getRaBills, calculateRaBill };
