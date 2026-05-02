// src/controllers/invoice.controller.js
const { query } = require('../config/database');

// GST calculation helper
const calculateGST = (taxableAmount, gstType, customRate = null) => {
  const rate = customRate || 18;  // default 18% for works contract
  let cgst = 0, sgst = 0, igst = 0;

  if (gstType === 'cgst_sgst') {
    cgst = (taxableAmount * (rate / 2)) / 100;
    sgst = cgst;
  } else if (gstType === 'igst') {
    igst = (taxableAmount * rate) / 100;
  }
  // 'exempt' = 0

  const totalGST = cgst + sgst + igst;
  const totalAmount = taxableAmount + totalGST;

  return {
    cgst_rate: gstType === 'cgst_sgst' ? rate / 2 : 0,
    sgst_rate: gstType === 'cgst_sgst' ? rate / 2 : 0,
    igst_rate: gstType === 'igst' ? rate : 0,
    cgst_amount: parseFloat(cgst.toFixed(2)),
    sgst_amount: parseFloat(sgst.toFixed(2)),
    igst_amount: parseFloat(igst.toFixed(2)),
    total_gst: parseFloat(totalGST.toFixed(2)),
    total_amount: parseFloat(totalAmount.toFixed(2))
  };
};

// TDS calculation helper
const calculateTDS = (amount, pan) => {
  // 194C: 2% for company/firm (PAN 4th char 'C'/'F'), 1% for individual/HUF (PAN 4th char 'P'/'H')
  // Threshold: ₹30,000 single payment or ₹1,00,000 aggregate
  const panType = pan?.charAt(3)?.toUpperCase();
  const rate = (panType === 'P' || panType === 'H') ? 1 : 2;
  return parseFloat(((amount * rate) / 100).toFixed(2));
};

// POST /api/v1/invoices
const createInvoice = async (req, res) => {
  try {
    const {
      project_id, invoice_number, invoice_date, client_name, client_gstin,
      taxable_amount, gst_type, gst_rate, hsn_code, tds_applicable, due_date, remarks
    } = req.body;

    const gst = calculateGST(parseFloat(taxable_amount), gst_type, gst_rate);
    const tds_amount = tds_applicable
      ? calculateTDS(parseFloat(taxable_amount))
      : 0;

    const result = await query(
      `INSERT INTO invoices (
        project_id, invoice_number, invoice_date, client_name, client_gstin,
        taxable_amount, gst_type, cgst_rate, sgst_rate, igst_rate,
        cgst_amount, sgst_amount, igst_amount, total_amount,
        hsn_code, tds_applicable, tds_amount, due_date, remarks, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        project_id, invoice_number, invoice_date, client_name, client_gstin,
        taxable_amount, gst_type, gst.cgst_rate, gst.sgst_rate, gst.igst_rate,
        gst.cgst_amount, gst.sgst_amount, gst.igst_amount, gst.total_amount,
        hsn_code || '9954', tds_applicable || true, tds_amount, due_date, remarks,
        req.user.id
      ]
    );

    res.status(201).json({
      message: 'Invoice created',
      data: result.rows[0],
      gst_summary: gst,
      tds_amount
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Invoice number already exists.' });
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/invoices
const getInvoices = async (req, res) => {
  try {
    const { project_id, payment_status, from_date, to_date } = req.query;
    let sql = `SELECT i.*, p.name as project_name FROM invoices i
               JOIN projects p ON i.project_id = p.id
               WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;

    if (project_id) { sql += ` AND i.project_id = $${idx++}`; params.push(project_id); }
    if (payment_status) { sql += ` AND i.payment_status = $${idx++}`; params.push(payment_status); }
    if (from_date) { sql += ` AND i.invoice_date >= $${idx++}`; params.push(from_date); }
    if (to_date) { sql += ` AND i.invoice_date <= $${idx++}`; params.push(to_date); }

    sql += ' ORDER BY i.invoice_date DESC';
    const result = await query(sql, params);
    res.json({ data: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/invoices/gst-summary
const getGSTSummary = async (req, res) => {
  try {
    const { quarter, year } = req.query;
    const result = await query(
      `SELECT
        SUM(taxable_amount) as total_taxable,
        SUM(cgst_amount) as total_cgst,
        SUM(sgst_amount) as total_sgst,
        SUM(igst_amount) as total_igst,
        SUM(cgst_amount + sgst_amount + igst_amount) as total_gst_collected,
        COUNT(*) as invoice_count,
        gst_type
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       WHERE p.company_id = $1
         AND EXTRACT(YEAR FROM invoice_date) = $2
       GROUP BY gst_type`,
      [req.user.company_id, year || new Date().getFullYear()]
    );

    // ITC (Input Tax Credit) - from purchases
    const itc = await query(
      `SELECT COALESCE(SUM(gst_amount),0) as total_itc
       FROM purchase_orders po
       JOIN projects p ON po.project_id = p.id
       WHERE p.company_id = $1 AND po.status != 'cancelled'
         AND EXTRACT(YEAR FROM po.po_date) = $2`,
      [req.user.company_id, year || new Date().getFullYear()]
    );

    res.json({
      gst_output: result.rows,
      itc_input: itc.rows[0],
      net_gst_payable: (
        result.rows.reduce((sum, r) => sum + parseFloat(r.total_gst_collected || 0), 0) -
        parseFloat(itc.rows[0].total_itc || 0)
      ).toFixed(2)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createInvoice, getInvoices, getGSTSummary, calculateGST, calculateTDS };
