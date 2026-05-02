// src/controllers/subcontractor.controller.js
const { query, withTransaction } = require('../config/database');

function genWoNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `WO-${ymd}-${rand}`;
}

function genBillNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `RA-${ymd}-${rand}`;
}

/** ── WORK ORDERS ───────────────────────────────────────────────────────────── */

// GET /api/v1/subcontractors/work-orders
const getWorkOrders = async (req, res) => {
  try {
    const { project_id, vendor_id, status } = req.query;
    let sql = `
      SELECT wo.*,
             wo.total_value AS contract_value,
             p.name AS project_name,
             v.name AS vendor_name,
             u.name AS manager_name,
             COALESCE(SUM(b.bill_amount), 0) AS total_billed
      FROM work_orders wo
      LEFT JOIN projects p ON wo.project_id = p.id
      LEFT JOIN vendors v ON wo.vendor_id = v.id
      LEFT JOIN users u ON wo.created_by = u.id
      LEFT JOIN subcontractor_bills b ON b.wo_id = wo.id
      WHERE p.company_id = $1
    `;
    const params = [req.user.company_id];
    let i = 2;

    if (project_id) { sql += ` AND wo.project_id = $${i++}`; params.push(project_id); }
    if (vendor_id)  { sql += ` AND wo.vendor_id = $${i++}`;  params.push(vendor_id); }
    if (status)     { sql += ` AND wo.status = $${i++}`;     params.push(status); }

    sql += ' GROUP BY wo.id, p.name, v.name, u.name ORDER BY wo.wo_date DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/subcontractors/work-orders/:id
const getWorkOrder = async (req, res) => {
  try {
    const woResult = await query(
      `SELECT wo.*,
              wo.total_value AS contract_value,
              p.name AS project_name, v.name AS vendor_name
       FROM work_orders wo
       JOIN projects p ON wo.project_id = p.id
       JOIN vendors v ON wo.vendor_id = v.id
       WHERE wo.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );

    if (!woResult.rows[0]) return res.status(404).json({ error: 'Work Order not found.' });

    const itemsResult = await query(
      `SELECT * FROM work_order_items WHERE wo_id = $1 ORDER BY id ASC`,
      [req.params.id]
    );

    res.json({ ...woResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/subcontractors/work-orders
const createWorkOrder = async (req, res) => {
  // Accept both frontend field names and internal names
  const {
    project_id,
    vendor_id,
    subject,
    scope_of_work,
    contract_value,  // frontend name
    total_value,     // internal name (fallback)
    start_date,
    end_date,
    terms_conditions,
    items,
  } = req.body;

  const wo_number = req.body.wo_number || genWoNumber();
  const wo_date = req.body.wo_date || new Date().toISOString().split('T')[0];
  const finalSubject = subject || scope_of_work || '';
  const finalTotalValue = parseFloat(contract_value || total_value || 0);

  try {
    let created;
    await withTransaction(async (client) => {
      const woResult = await client.query(
        `INSERT INTO work_orders
           (project_id, vendor_id, wo_number, wo_date,
            subject, work_description, scope_of_work,
            start_date, end_date, total_value, contract_amount,
            terms_conditions, created_by)
         VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$9,$10,$11)
         RETURNING *`,
        [
          project_id, vendor_id, wo_number, wo_date,
          finalSubject, scope_of_work || null,
          start_date || null, end_date || null, finalTotalValue,
          terms_conditions || null, req.user.id,
        ]
      );
      const wo = woResult.rows[0];

      // Insert line items when provided (advanced flow) — update total_value from item sum
      if (items && items.length > 0) {
        let itemsTotal = 0;
        for (const item of items) {
          itemsTotal += parseFloat(item.quantity) * parseFloat(item.rate);
          await client.query(
            `INSERT INTO work_order_items (wo_id, description, unit, quantity, rate, remarks)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [wo.id, item.description, item.unit, item.quantity, item.rate, item.remarks || null]
          );
        }
        await client.query(
          `UPDATE work_orders SET total_value = $1, contract_amount = $1 WHERE id = $2`,
          [itemsTotal, wo.id]
        );
        wo.total_value = itemsTotal;
        wo.contract_amount = itemsTotal;
      }

      wo.contract_value = wo.total_value;
      created = wo;
    });

    res.status(201).json({ message: 'Work Order created successfully.', data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** ── MEASUREMENT BOOK ──────────────────────────────────────────────────────── */

// POST /api/v1/subcontractors/measurements
const createMeasurement = async (req, res) => {
  try {
    // Accept both frontend field names and internal names
    const wo_id = req.body.wo_id || req.body.work_order_id;
    const quantity = req.body.quantity || req.body.measured_qty;
    const {
      wo_item_id,
      measurement_date,
      item_description,
      unit,
      rate,
      remarks,
      location_details,
      photo_evidence,
    } = req.body;

    const result = await query(
      `INSERT INTO subcontractor_measurements
         (wo_id, wo_item_id, measurement_date, quantity,
          item_description, unit, rate, remarks, location_details, photo_evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        wo_id,
        wo_item_id || null,
        measurement_date || new Date().toISOString().split('T')[0],
        quantity,
        item_description || null,
        unit || null,
        rate ? parseFloat(rate) : null,
        remarks || null,
        location_details || null,
        photo_evidence || null,
      ]
    );
    res.status(201).json({ message: 'Measurement recorded.', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/subcontractors/measurements?project_id=&wo_id=&status=
const getMeasurements = async (req, res) => {
  try {
    const { project_id, wo_id, status } = req.query;
    let sql = `
      SELECT sm.*,
             sm.quantity        AS measured_qty,
             COALESCE(sm.item_description, woi.description) AS item_description,
             COALESCE(sm.unit, woi.unit)                    AS unit,
             COALESCE(sm.rate, woi.rate)                    AS rate,
             wo.wo_number,
             v.name  AS vendor_name,
             p.name  AS project_name
      FROM subcontractor_measurements sm
      JOIN work_orders wo ON sm.wo_id = wo.id
      JOIN projects p     ON wo.project_id = p.id
      JOIN vendors v      ON wo.vendor_id = v.id
      LEFT JOIN work_order_items woi ON sm.wo_item_id = woi.id
      WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let i = 2;
    if (project_id) { sql += ` AND wo.project_id = $${i++}`; params.push(project_id); }
    if (wo_id)      { sql += ` AND sm.wo_id = $${i++}`;      params.push(wo_id); }
    if (status)     { sql += ` AND sm.status = $${i++}`;     params.push(status); }
    sql += ' ORDER BY sm.measurement_date DESC, sm.id DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** ── BILLING ───────────────────────────────────────────────────────────────── */

// POST /api/v1/subcontractors/bills
const createBill = async (req, res) => {
  try {
    // Accept both frontend simplified payload and advanced payload
    const wo_id = req.body.wo_id || req.body.work_order_id;
    const {
      bill_date,
      period_start,
      period_end,
      due_date,
      tax_amount,
      advance_recovery,
      other_deductions,
      remarks,
      items,                 // advanced flow: line items
    } = req.body;

    const bill_number = req.body.bill_number || genBillNumber();

    // Simplified flow: bill_amount + tax_amount + retention_percent
    const bill_amount     = parseFloat(req.body.bill_amount || 0);
    const taxAmt          = parseFloat(tax_amount || 0);
    const retentionPct    = parseFloat(req.body.retention_percent || req.body.retention_pct || 0);

    // Advanced flow deduction fields
    const tds_pct         = parseFloat(req.body.tds_pct || 0);
    const security_pct    = parseFloat(req.body.security_pct || 0);

    // Derive project_id from work order when not provided
    let project_id = req.body.project_id;
    if (!project_id) {
      const woRow = await query(
        `SELECT project_id FROM work_orders WHERE id = $1`, [wo_id]
      );
      if (!woRow.rows[0]) return res.status(400).json({ error: 'Work order not found.' });
      project_id = woRow.rows[0].project_id;
    }

    let created;
    await withTransaction(async (client) => {
      let grossAmount = bill_amount;

      // Advanced flow: compute gross from items array
      if (items && items.length > 0) {
        grossAmount = items.reduce((sum, item) => sum + (item.billed_qty * item.rate), 0);
      }

      const tdsAmount       = (grossAmount * tds_pct) / 100;
      const retentionAmount = (grossAmount * retentionPct) / 100;
      const securityAmount  = (grossAmount * security_pct) / 100;
      const advRecovery     = parseFloat(advance_recovery || 0);
      const otherDed        = parseFloat(other_deductions || 0);

      const netPayable = grossAmount + taxAmt
        - tdsAmount - retentionAmount - securityAmount - advRecovery - otherDed;

      const billResult = await client.query(
        `INSERT INTO subcontractor_bills (
           project_id, wo_id, bill_number, bill_date, period_start, period_end, due_date,
           bill_amount, tax_amount, retention_percent,
           gross_amount, tds_pct, tds_amount, retention_pct, retention_amount,
           security_pct, security_amount, advance_recovery, other_deductions,
           net_payable, remarks
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [
          project_id, wo_id, bill_number,
          bill_date   || new Date().toISOString().split('T')[0],
          period_start || null,
          period_end   || null,
          due_date     || null,
          grossAmount, taxAmt, retentionPct,
          grossAmount, tds_pct, tdsAmount, retentionPct, retentionAmount,
          security_pct, securityAmount, advRecovery, otherDed,
          netPayable, remarks || null,
        ]
      );
      const bill = billResult.rows[0];

      // Insert bill items and update measurement status (advanced flow)
      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(
            `INSERT INTO subcontractor_bill_items
               (bill_id, wo_item_id, measurement_id, billed_qty, rate, amount)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [bill.id, item.wo_item_id, item.measurement_id || null,
             item.billed_qty, item.rate, item.billed_qty * item.rate]
          );
          if (item.measurement_id) {
            await client.query(
              `UPDATE subcontractor_measurements SET status = 'billed' WHERE id = $1`,
              [item.measurement_id]
            );
          }
        }
      }

      created = bill;
    });

    res.status(201).json({ message: 'Subcontractor Bill generated successfully.', data: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/subcontractors/bills
const getBills = async (req, res) => {
  try {
    const { project_id, wo_id } = req.query;
    let sql = `
      SELECT b.*,
             p.name          AS project_name,
             wo.wo_number,
             v.name          AS vendor_name
      FROM subcontractor_bills b
      JOIN projects p    ON b.project_id = p.id
      JOIN work_orders wo ON b.wo_id = wo.id
      JOIN vendors v     ON wo.vendor_id = v.id
      WHERE p.company_id = $1
    `;
    const params = [req.user.company_id];
    let i = 2;

    if (project_id) { sql += ` AND b.project_id = $${i++}`; params.push(project_id); }
    if (wo_id)      { sql += ` AND b.wo_id = $${i++}`;      params.push(wo_id); }

    sql += ' ORDER BY b.bill_date DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/subcontractors/bills/:id
const getBill = async (req, res) => {
  try {
    const billResult = await query(
      `SELECT b.*,
              p.name    AS project_name,
              wo.wo_number,
              v.name    AS vendor_name,
              v.address AS vendor_address,
              v.gstin   AS vendor_gstin
       FROM subcontractor_bills b
       JOIN projects p    ON b.project_id = p.id
       JOIN work_orders wo ON b.wo_id = wo.id
       JOIN vendors v     ON wo.vendor_id = v.id
       WHERE b.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );

    if (!billResult.rows[0]) return res.status(404).json({ error: 'Bill not found.' });

    const itemsResult = await query(
      `SELECT bi.*, woi.description, woi.unit
       FROM subcontractor_bill_items bi
       JOIN work_order_items woi ON bi.wo_item_id = woi.id
       WHERE bi.bill_id = $1 ORDER BY bi.id ASC`,
      [req.params.id]
    );

    res.json({ ...billResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** ── WORK ORDER UPDATE ─────────────────────────────────────────────────────── */

// PATCH /api/v1/subcontractors/work-orders/:id
const updateWorkOrder = async (req, res) => {
  try {
    const { status, subject, terms_conditions } = req.body;
    const sets = [];
    const params = [req.params.id, req.user.company_id];
    let i = 3;
    if (status)                          { sets.push(`status = $${i++}`);                                           params.push(status); }
    if (subject)                         { sets.push(`subject = $${i}, work_description = $${i++}`);               params.push(subject); }
    if (terms_conditions !== undefined)  { sets.push(`terms_conditions = $${i++}`);                                 params.push(terms_conditions); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    const result = await query(
      `UPDATE work_orders SET ${sets.join(', ')}
       WHERE id = $1
         AND project_id IN (SELECT id FROM projects WHERE company_id = $2)
       RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Work order not found' });
    const row = result.rows[0];
    res.json({ data: { ...row, contract_value: row.total_value || row.contract_amount } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** ── BILL UPDATE (approve / pay) ───────────────────────────────────────────── */

// PATCH /api/v1/subcontractors/bills/:id
const updateBill = async (req, res) => {
  try {
    const { status, payment_date, payment_ref, payment_mode } = req.body;
    const check = await query(
      `SELECT b.id FROM subcontractor_bills b
       JOIN projects p ON b.project_id = p.id
       WHERE b.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'Bill not found' });

    const sets = ['updated_at = NOW()'];
    const params = [req.params.id];
    let i = 2;
    if (status)       { sets.push(`status = $${i++}`);       params.push(status); }
    if (payment_date) { sets.push(`payment_date = $${i++}`); params.push(payment_date); }
    if (payment_ref)  { sets.push(`payment_ref = $${i++}`);  params.push(payment_ref); }
    if (payment_mode) { sets.push(`payment_mode = $${i++}`); params.push(payment_mode); }

    const result = await query(
      `UPDATE subcontractor_bills SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** ── DASHBOARD / SUMMARY ────────────────────────────────────────────────────── */

// GET /api/v1/subcontractors/dashboard?project_id=
const getDashboard = async (req, res) => {
  try {
    const { project_id } = req.query;
    const cond   = project_id ? 'AND wo.project_id = $2' : '';
    const params = project_id ? [req.user.company_id, project_id] : [req.user.company_id];

    const [kpi, byVendor] = await Promise.all([
      query(`
        SELECT
          COUNT(DISTINCT wo.id)::int                                           AS total_wo,
          COUNT(DISTINCT CASE WHEN wo.status IN ('active','approved') THEN wo.id END)::int AS active_wo,
          COALESCE(SUM(wo.total_value), 0)                                    AS total_contract_value,
          COALESCE(SUM(b.bill_amount), 0)                                     AS total_billed,
          COALESCE(SUM(CASE WHEN b.status = 'paid' THEN b.net_payable END), 0) AS total_paid,
          COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END)::int   AS bills_pending_approval
        FROM work_orders wo
        JOIN projects p ON wo.project_id = p.id
        LEFT JOIN subcontractor_bills b ON b.wo_id = wo.id
        WHERE p.company_id = $1 ${cond}
      `, params),
      query(`
        SELECT
          v.name                                                               AS vendor_name,
          COUNT(DISTINCT wo.id)::int                                          AS wo_count,
          COALESCE(SUM(wo.total_value), 0)                                    AS contract_value,
          COALESCE(SUM(b.bill_amount), 0)                                     AS billed_amount,
          COALESCE(SUM(CASE WHEN b.status='paid' THEN b.net_payable END), 0) AS paid_amount
        FROM work_orders wo
        JOIN projects p ON wo.project_id = p.id
        JOIN vendors v  ON wo.vendor_id = v.id
        LEFT JOIN subcontractor_bills b ON b.wo_id = wo.id
        WHERE p.company_id = $1 ${cond}
        GROUP BY v.id, v.name
        ORDER BY contract_value DESC
      `, params),
    ]);

    res.json({ kpi: kpi.rows[0], byVendor: byVendor.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getWorkOrders,
  getWorkOrder,
  createWorkOrder,
  getMeasurements,
  createMeasurement,
  updateWorkOrder,
  createBill,
  getBills,
  getBill,
  updateBill,
  getDashboard,
};
