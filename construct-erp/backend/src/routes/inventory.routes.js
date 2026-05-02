// src/routes/inventory.routes.js
const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const router = express.Router();
router.use(authenticate);

// multer: memory storage for xlsx import
const xlsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only xlsx/xls/csv files supported'), ok);
  },
});

// Column name normaliser — handles typos & mixed case from the Excel
function normaliseHeader(h) {
  return String(h || '').toLowerCase().replace(/[\s_\-\.]+/g, '').replace(/[^a-z0-9]/g, '');
}
const COL_MAP = {
  // material
  materialdescription: 'material_name', materialdescription: 'material_name',
  materialdescrpition: 'material_name', materialdescrption: 'material_name',
  materialdesc: 'material_name', material: 'material_name', description: 'material_name',
  // others
  category: 'category', unit: 'unit',
  openingstock: 'opening_stock', closingstock: 'closing_stock',
  rate: 'unit_rate', slno: null, totalissued: null,
  openingstockvaluetotal: null, closingstockvaluetotal: null, gst: null, grandtotal: null,
};

function mapRow(rawRow) {
  const out = {};
  for (const [rawKey, val] of Object.entries(rawRow)) {
    const norm = normaliseHeader(rawKey);
    const mapped = COL_MAP[norm];
    if (mapped) out[mapped] = val;
  }
  return out;
}

// GET /inventory — list with optional project filter
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT i.*, p.name AS project_name
      FROM inventory i
      JOIN projects p ON i.project_id = p.id
      WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    if (project_id) { sql += ` AND i.project_id = $2`; params.push(project_id); }
    sql += ` ORDER BY p.name, i.material_name`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/valuation?project_id= — stock value (qty × rate) per project / category
router.get('/valuation', async (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT
        i.project_id,
        p.name                                                             AS project_name,
        COALESCE(NULLIF(TRIM(i.category), ''), 'Uncategorized')           AS category,
        COUNT(*)::int                                                      AS item_count,
        SUM(i.closing_stock)::numeric                                     AS total_qty,
        SUM(i.closing_stock * COALESCE(i.unit_rate, 0))::numeric          AS stock_value,
        MAX(i.last_updated)                                               AS last_updated
      FROM inventory i
      JOIN projects p ON i.project_id = p.id
      WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    if (project_id) { sql += ` AND i.project_id = $2`; params.push(project_id); }
    sql += ` GROUP BY i.project_id, p.name, i.category ORDER BY stock_value DESC NULLS LAST`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Valuation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/categories — distinct non-empty categories from store ledger
router.get('/categories', async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT TRIM(i.category) AS category
      FROM inventory i
      JOIN projects p ON i.project_id = p.id
      WHERE p.company_id = $1
        AND i.category IS NOT NULL
        AND TRIM(i.category) <> ''
      ORDER BY category ASC
    `, [req.user.company_id]);
    res.json({ data: result.rows.map(r => r.category) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/items-lookup — all material names with their category & unit for TQS bill autocomplete
router.get('/items-lookup', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        TRIM(i.material_name) AS material_name,
        TRIM(COALESCE(i.category, '')) AS category,
        TRIM(COALESCE(i.unit, ''))     AS unit
      FROM inventory i
      JOIN projects p ON i.project_id = p.id
      WHERE p.company_id = $1
        AND i.material_name IS NOT NULL
        AND TRIM(i.material_name) <> ''
      ORDER BY i.category ASC, i.material_name ASC
    `, [req.user.company_id]);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/monthly-report?month=YYYY-MM&project_id=
router.get('/monthly-report', async (req, res) => {
  try {
    const { month, project_id } = req.query;
    // Default to current month
    const target = month || new Date().toISOString().slice(0, 7);
    const monthStart = `${target}-01`;
    const monthEnd   = new Date(new Date(monthStart).getFullYear(),
                                new Date(monthStart).getMonth() + 1, 1)
                        .toISOString().slice(0, 10);

    let sql = `
      SELECT
        i.id, i.material_name, i.unit, i.site_location,
        i.opening_stock, i.closing_stock,
        COALESCE(i.unit_rate, 0)  AS rate,
        i.category, i.reorder_level, i.minimum_level,
        p.name AS project_name,
        COALESCE(rx.received_qty, 0)   AS received_qty,
        COALESCE(ix.issued_qty, 0)     AS issued_qty,
        COALESCE(ix.last_issued_at, NULL) AS last_issued_at
      FROM inventory i
      JOIN projects p ON i.project_id = p.id
      LEFT JOIN (
        SELECT inventory_id,
               SUM(quantity) AS received_qty
        FROM stock_transactions
        WHERE transaction_type IN ('grn','transfer_in')
          AND transacted_at >= $2 AND transacted_at < $3
        GROUP BY inventory_id
      ) rx ON rx.inventory_id = i.id
      LEFT JOIN (
        SELECT inventory_id,
               SUM(quantity)   AS issued_qty,
               MAX(transacted_at) AS last_issued_at
        FROM stock_transactions
        WHERE transaction_type IN ('issue','transfer_out')
          AND transacted_at >= $2 AND transacted_at < $3
        GROUP BY inventory_id
      ) ix ON ix.inventory_id = i.id
      WHERE p.company_id = $1`;

    const params = [req.user.company_id, monthStart, monthEnd];
    if (project_id) { sql += ` AND i.project_id = $4`; params.push(project_id); }
    sql += ` ORDER BY p.name, i.material_name`;

    const result = await query(sql, params);

    const rows = result.rows.map(r => {
      const received  = parseFloat(r.received_qty)  || 0;
      const issued    = parseFloat(r.issued_qty)    || 0;
      const closing   = parseFloat(r.closing_stock) || 0;
      const rate      = parseFloat(r.rate)          || 0;
      // back-calculate opening from current closing + this month's movements
      const opening   = closing - received + issued;
      return {
        ...r,
        opening_stock:  Math.max(0, opening),
        received_qty:   received,
        issued_qty:     issued,
        total_qty:      Math.max(0, opening) + received,
        closing_stock:  closing,
        stock_at_site:  closing,
        stock_value:    closing * rate,
      };
    });

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const { project_id } = req.query;
    let sql = `
      SELECT i.*, p.name AS project_name
      FROM inventory i
      JOIN projects p ON i.project_id = p.id
      WHERE p.company_id = $1
        AND i.reorder_level > 0
        AND i.closing_stock <= i.reorder_level`;
    const params = [req.user.company_id];
    if (project_id) { sql += ` AND i.project_id = $2`; params.push(project_id); }
    sql += ` ORDER BY (i.closing_stock / NULLIF(i.reorder_level, 0)) ASC`;
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/ledger — stock transactions for an inventory item
router.get('/ledger', async (req, res) => {
  try {
    const { inventory_id } = req.query;
    if (!inventory_id) return res.status(400).json({ error: 'inventory_id required' });
    // Verify company isolation
    const inv = await query(
      `SELECT i.*, p.company_id FROM inventory i JOIN projects p ON i.project_id = p.id WHERE i.id = $1`,
      [inventory_id]
    );
    if (!inv.rows.length || inv.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    const txns = await query(
      `SELECT st.*, u.name AS transacted_by_name
       FROM stock_transactions st
       LEFT JOIN users u ON st.transacted_by = u.id
       WHERE st.inventory_id = $1
       ORDER BY st.transacted_at ASC`,
      [inventory_id]
    );
    res.json({ inventory: inv.rows[0], transactions: txns.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /inventory/:id/batches — list active batches for an item
router.get('/:id/batches', async (req, res) => {
  try {
     const batches = await query(
       `SELECT * FROM inventory_batches 
        WHERE inventory_id = $1 AND current_quantity > 0 AND status = 'active'
        ORDER BY received_date ASC, created_at ASC`,
       [req.params.id]
     );
     res.json({ data: batches.rows });
  } catch (err) {
     res.status(500).json({ error: err.message });
  }
});

// POST /inventory/issue — issue material from stock
router.post('/issue', async (req, res) => {
  try {
    const {
      inventory_id, project_id, quantity, issued_to,
      mrs_id, reference_number, remarks
    } = req.body;

    if (!inventory_id || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ error: 'inventory_id and positive quantity are required' });
    }

    const result = await withTransaction(async (client) => {
      // Lock row and check stock
      const inv = await client.query(
        `SELECT i.*, p.company_id
         FROM inventory i JOIN projects p ON i.project_id = p.id
         WHERE i.id = $1 FOR UPDATE`,
        [inventory_id]
      );
      if (!inv.rows.length || inv.rows[0].company_id !== req.user.company_id) {
        throw Object.assign(new Error('Inventory item not found'), { status: 404 });
      }
      const item = inv.rows[0];
      const issueQty = parseFloat(quantity);
      if (parseFloat(item.closing_stock) < issueQty) {
        throw Object.assign(
          new Error(`Insufficient stock. Available: ${item.closing_stock} ${item.unit}`),
          { status: 400 }
        );
      }

      // 2. Deduct stock from Inventory (Aggregate)
      await client.query(
        `UPDATE inventory SET closing_stock = closing_stock - $1, last_updated = NOW() WHERE id = $2`,
        [issueQty, inventory_id]
      );

      // 3. FIFO Batch Consumption Logic
      let remainingToIssue = issueQty;
      const batches = await client.query(
        `SELECT * FROM inventory_batches 
         WHERE inventory_id = $1 AND current_quantity > 0 AND status = 'active'
         ORDER BY received_date ASC, created_at ASC
         FOR UPDATE`,
        [inventory_id]
      );

      for (const b of batches.rows) {
        if (remainingToIssue <= 0) break;
        const availableInBatch = parseFloat(b.current_quantity);
        const takeFromBatch = Math.min(availableInBatch, remainingToIssue);
        
        // Update batch quantity
        await client.query(
          `UPDATE inventory_batches 
           SET current_quantity = current_quantity - $1, 
               status = CASE WHEN (current_quantity - $1) <= 0 THEN 'consumed' ELSE 'active' END,
               updated_at = NOW()
           WHERE id = $2`,
          [takeFromBatch, b.id]
        );

        // Log batch-specific movement
        await client.query(
          `INSERT INTO batch_transactions (batch_id, transaction_type, quantity)
           VALUES ($1, 'issue', $2)`,
          [b.id, takeFromBatch]
        );

        remainingToIssue -= takeFromBatch;
      }

      if (remainingToIssue > 0.001) {
          throw new Error('FIFO Error: Aggregate stock and batch sums are out of sync.');
      }

      // 4. Log Master Transaction
      const txn = await client.query(
        `INSERT INTO stock_transactions
           (project_id, inventory_id, transaction_type, quantity, reference_id, reference_number, issued_to, remarks, transacted_by)
         VALUES ($1,$2,'issue',$3,$4,$5,$6,$7,$8) RETURNING *`,
        [item.project_id, inventory_id, issueQty, mrs_id || null, reference_number || null, issued_to || null, remarks || null, req.user.id]
      );

      // 5. Update MRS status if referenced
      if (mrs_id) {
        await client.query(
          `UPDATE material_requisitions SET status = 'issued', updated_at = NOW() WHERE id = $1`,
          [mrs_id]
        );
      }

      return txn.rows[0];
    });

    res.status(201).json({ message: 'Material issued and stock updated', data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /inventory/transfer — transfer stock between sites/projects
router.post('/transfer', async (req, res) => {
  try {
    const { from_inventory_id, to_project_id, to_site_location, quantity, remarks } = req.body;
    if (!from_inventory_id || !quantity || parseFloat(quantity) <= 0) {
      return res.status(400).json({ error: 'from_inventory_id and positive quantity are required' });
    }

    const result = await withTransaction(async (client) => {
      const src = await client.query(
        `SELECT i.*, p.company_id FROM inventory i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 FOR UPDATE`,
        [from_inventory_id]
      );
      if (!src.rows.length || src.rows[0].company_id !== req.user.company_id) {
        throw Object.assign(new Error('Source inventory item not found'), { status: 404 });
      }
      const item = src.rows[0];
      const transferQty = parseFloat(quantity);
      if (parseFloat(item.closing_stock) < transferQty) {
        throw Object.assign(new Error(`Insufficient stock: ${item.closing_stock} ${item.unit} available`), { status: 400 });
      }

      const refNum = `TRF-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      // Deduct from source
      await client.query(
        `UPDATE inventory SET closing_stock = closing_stock - $1, last_updated = NOW() WHERE id = $2`,
        [transferQty, from_inventory_id]
      );
      await client.query(
        `INSERT INTO stock_transactions (project_id,inventory_id,transaction_type,quantity,reference_number,remarks,transacted_by)
         VALUES ($1,$2,'transfer_out',$3,$4,$5,$6)`,
        [item.project_id, from_inventory_id, transferQty, refNum, remarks, req.user.id]
      );

      // Upsert destination
      const dest = await client.query(
        `INSERT INTO inventory (project_id,material_name,unit,site_location,opening_stock,closing_stock)
         VALUES ($1,$2,$3,$4,0,$5)
         ON CONFLICT (project_id,material_name,site_location)
         DO UPDATE SET closing_stock = inventory.closing_stock + $5, last_updated = NOW()
         RETURNING id`,
        [to_project_id || item.project_id, item.material_name, item.unit, to_site_location || item.site_location, transferQty]
      );
      await client.query(
        `INSERT INTO stock_transactions (project_id,inventory_id,transaction_type,quantity,reference_number,remarks,transacted_by)
         VALUES ($1,$2,'transfer_in',$3,$4,$5,$6)`,
        [to_project_id || item.project_id, dest.rows[0].id, transferQty, refNum, remarks, req.user.id]
      );

      return { ref: refNum, qty: transferQty, unit: item.unit };
    });

    res.status(201).json({ message: 'Stock transferred successfully', data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /inventory — create a new inventory item (used from MRS "New Item" flow)
router.post('/', async (req, res) => {
  try {
    const { project_id, material_name, category, unit, opening_stock = 0 } = req.body;
    if (!project_id || !material_name) {
      return res.status(400).json({ error: 'project_id and material_name are required' });
    }
    // Verify project belongs to this company
    const proj = await query('SELECT id FROM projects WHERE id=$1 AND company_id=$2', [project_id, req.user.company_id]);
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' });
    // Check duplicate
    const existing = await query(
      `SELECT id FROM inventory WHERE project_id=$1 AND LOWER(TRIM(material_name))=LOWER(TRIM($2))`,
      [project_id, material_name]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Material already exists in store ledger for this project' });
    }
    const result = await query(
      `INSERT INTO inventory (project_id, material_name, category, unit, opening_stock, closing_stock, last_updated)
       VALUES ($1, $2, $3, $4, $5, $5, NOW())
       RETURNING id, material_name, category, unit, opening_stock, closing_stock`,
      [project_id, material_name.trim(), (category || '').trim() || null, (unit || '').trim() || null, parseFloat(opening_stock) || 0]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /inventory/:id — update minimum/reorder levels
router.patch('/:id', async (req, res) => {
  try {
    const { minimum_level, reorder_level, unit_rate, category } = req.body;
    const check = await query(
      `SELECT i.id FROM inventory i JOIN projects p ON i.project_id = p.id WHERE i.id = $1 AND p.company_id = $2`,
      [req.params.id, req.user.company_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });

    await query(
      `UPDATE inventory SET
         minimum_level = COALESCE($1, minimum_level),
         reorder_level = COALESCE($2, reorder_level),
         unit_rate     = COALESCE($3, unit_rate),
         category      = COALESCE($4, category),
         last_updated  = NOW()
       WHERE id = $5`,
      [minimum_level, reorder_level, unit_rate, category, req.params.id]
    );
    res.json({ message: 'Inventory updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /inventory/import/preview — parse file, return rows without saving
router.post('/import/preview', xlsUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const preview = rows
      .map(mapRow)
      .filter(r => r.material_name && String(r.material_name).trim())
      .map(r => ({
        material_name: String(r.material_name).trim(),
        category:      String(r.category || '').trim() || null,
        unit:          String(r.unit || '').trim() || 'NOS',
        opening_stock: parseFloat(r.opening_stock) || 0,
        closing_stock: parseFloat(r.closing_stock) || 0,
        unit_rate:     parseFloat(r.unit_rate)     || 0,
      }));
    res.json({ data: preview, total: preview.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /inventory/import — parse + upsert into inventory
router.post('/import', xlsUpload.single('file'), async (req, res) => {
  try {
    if (!req.file)        return res.status(400).json({ error: 'No file uploaded' });
    const { project_id, site_location = 'main', overwrite = 'false' } = req.body;
    if (!project_id)      return res.status(400).json({ error: 'project_id is required' });

    // Verify project belongs to company
    const projCheck = await query(
      `SELECT id FROM projects WHERE id = $1 AND company_id = $2`,
      [project_id, req.user.company_id]
    );
    if (!projCheck.rows.length) return res.status(403).json({ error: 'Project not found or access denied' });

    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const items = rows
      .map(mapRow)
      .filter(r => r.material_name && String(r.material_name).trim());

    let inserted = 0, updated = 0, skipped = 0;
    const errors = [];
    const skippedItems = [];

    for (const r of items) {
      try {
        const material_name = String(r.material_name).trim();
        const unit          = String(r.unit || '').trim() || 'NOS';
        const opening       = parseFloat(r.opening_stock) || 0;
        const closing       = parseFloat(r.closing_stock) || 0;
        const rate          = parseFloat(r.unit_rate)     || 0;
        const category      = String(r.category || '').trim() || null;

        if (!material_name) { skipped++; continue; }

        // Check if already exists — match by project + material name (case-insensitive),
        // regardless of site_location to prevent duplicates across sites
        const existing = await query(
          `SELECT id FROM inventory WHERE project_id = $1 AND LOWER(TRIM(material_name)) = LOWER(TRIM($2))
           ORDER BY CASE WHEN site_location = $3 THEN 0 ELSE 1 END, last_updated DESC NULLS LAST LIMIT 1`,
          [project_id, material_name, site_location]
        );

        if (existing.rows.length > 0) {
          if (overwrite === 'true') {
            await query(
              `UPDATE inventory SET
                 opening_stock = $1, closing_stock = $2,
                 unit_rate = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE unit_rate END,
                 category  = CASE WHEN $4::text IS NOT NULL THEN $4::text ELSE category END,
                 unit = $5, last_updated = NOW()
               WHERE id = $6`,
              [opening, closing, rate, category, unit, existing.rows[0].id]
            );
            updated++;
          } else {
            skipped++;
            skippedItems.push(material_name);
          }
        } else {
          await query(
            `INSERT INTO inventory
               (project_id, material_name, unit, site_location, opening_stock, closing_stock, unit_rate, category)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text)`,
            [project_id, material_name, unit, site_location, opening, closing, rate, category]
          );
          inserted++;
        }
      } catch (e) {
        errors.push({ material: r.material_name, error: e.message });
      }
    }

    res.json({ message: 'Import complete', inserted, updated, skipped, skippedItems, errors, total: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
