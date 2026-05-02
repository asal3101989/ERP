// src/routes/norms.routes.js 
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { query } = require('../config/database');

router.use(authenticate);

// GET /api/v1/norms — List all norms
router.get('/', async (req, res) => {
  try {
    const { boq_item_id } = req.query;
    let sql = `SELECT n.*, b.description as boq_description, b.item_no 
               FROM consumption_norms n
               JOIN boq_items b ON n.boq_item_id = b.id
               WHERE b.company_id = $1`;
    const params = [req.user.company_id];
    let idx = 2;

    if (boq_item_id) { sql += ` AND n.boq_item_id = $${idx++}`; params.push(boq_item_id); }

    sql += ' ORDER BY b.item_no, n.material_name';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/norms — Add a norm
router.post('/', authorize('super_admin','admin','qs_engineer'), async (req, res) => {
  try {
    const { boq_item_id, material_name, unit, norm_quantity, allowed_wastage_pct } = req.body;
    
    // Check if BoQ item belongs to company (Security)
    const boqRes = await query('SELECT id FROM boq_items WHERE id=$1 AND company_id=$2', [boq_item_id, req.user.company_id]);
    if (!boqRes.rows.length) return res.status(403).json({ error: 'Access denied to this BoQ item' });

    const result = await query(
      `INSERT INTO consumption_norms (boq_item_id, material_name, unit, norm_quantity, allowed_wastage_pct)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [boq_item_id, material_name, unit, norm_quantity, allowed_wastage_pct || 5]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/norms/:id
router.delete('/:id', authorize('super_admin','admin','qs_engineer'), async (req, res) => {
  try {
    await query('DELETE FROM consumption_norms WHERE id = $1', [req.params.id]);
    res.json({ message: 'Norm deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
