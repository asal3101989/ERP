// src/routes/tender.routes.js
// Tender Management — Section A: Procurement Tenders + Section B: Bid Opportunities
const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');

// ─── Fiscal-year auto-number helpers ─────────────────────────────────────────
function getFY() {
  const now = new Date(), y = now.getFullYear();
  return now.getMonth() >= 3
    ? `${String(y).slice(2)}${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}${String(y).slice(2)}`;
}
async function nextNumber(client, companyId, prefix, table, col) {
  const p = `${prefix}-${getFY()}-`;
  const r = await client.query(
    `SELECT ${col} FROM ${table} WHERE company_id=$1 AND ${col} LIKE $2 ORDER BY ${col} DESC LIMIT 1`,
    [companyId, `${p}%`]
  );
  const seq = r.rows[0] ? parseInt(r.rows[0][col].slice(-3)) + 1 : 1;
  return `${p}${String(seq).padStart(3, '0')}`;
}

// ─── Multer setup ─────────────────────────────────────────────────────────────
const tenderUploadDir = path.join(__dirname, '../../uploads/tenders');
const bidUploadDir    = path.join(__dirname, '../../uploads/bid-opportunities');
if (!fs.existsSync(tenderUploadDir)) fs.mkdirSync(tenderUploadDir, { recursive: true });
if (!fs.existsSync(bidUploadDir))    fs.mkdirSync(bidUploadDir,    { recursive: true });

const tenderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(tenderUploadDir, req.params.id || 'misc');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const bidStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(bidUploadDir, req.params.id || 'misc');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const uploadTender = multer({ storage: tenderStorage, limits: { fileSize: 20 * 1024 * 1024 } });
const uploadBid    = multer({ storage: bidStorage,    limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Table initialisation ─────────────────────────────────────────────────────
const initTable = async () => {
  // Section A — Procurement Tenders
  await query(`
    CREATE TABLE IF NOT EXISTS tenders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id),
      project_id UUID REFERENCES projects(id),
      tender_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      scope_of_work TEXT,
      tender_type TEXT DEFAULT 'works',
      work_package TEXT,
      estimated_value NUMERIC(15,2),
      emd_required BOOLEAN DEFAULT FALSE,
      emd_amount NUMERIC(15,2),
      publish_date TIMESTAMPTZ,
      bid_open_date TIMESTAMPTZ,
      bid_close_date TIMESTAMPTZ,
      pre_bid_date TIMESTAMPTZ,
      expected_start_date DATE,
      contract_duration INTEGER,
      status TEXT DEFAULT 'draft',
      cancellation_reason TEXT,
      awarded_vendor_id UUID REFERENCES vendors(id),
      awarded_bid_id UUID,
      awarded_amount NUMERIC(15,2),
      award_date TIMESTAMPTZ,
      po_id UUID,
      created_by UUID REFERENCES users(id),
      published_by UUID REFERENCES users(id),
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, tender_number)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tender_invited_vendors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      vendor_id UUID NOT NULL REFERENCES vendors(id),
      invited_at TIMESTAMPTZ DEFAULT NOW(),
      responded BOOLEAN DEFAULT FALSE,
      UNIQUE(tender_id, vendor_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tender_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      doc_type TEXT DEFAULT 'general',
      file_name TEXT,
      file_path TEXT,
      file_size INTEGER,
      uploaded_by UUID REFERENCES users(id),
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tender_scope_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      item_code TEXT,
      description TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity NUMERIC(12,3) DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tender_bids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      vendor_id UUID NOT NULL REFERENCES vendors(id),
      company_id UUID NOT NULL,
      bid_reference TEXT,
      submission_date TIMESTAMPTZ,
      validity_days INTEGER DEFAULT 90,
      bid_amount NUMERIC(15,2),
      discount_pct NUMERIC(5,2) DEFAULT 0,
      final_amount NUMERIC(15,2),
      mobilisation_advance_pct NUMERIC(5,2),
      retention_pct NUMERIC(5,2),
      completion_days INTEGER,
      technical_score NUMERIC(5,2),
      financial_score NUMERIC(5,2),
      combined_score NUMERIC(5,2),
      emd_submitted BOOLEAN DEFAULT FALSE,
      emd_reference TEXT,
      status TEXT DEFAULT 'submitted',
      remarks TEXT,
      is_winner BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tender_id, vendor_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS tender_bid_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bid_id UUID NOT NULL REFERENCES tender_bids(id) ON DELETE CASCADE,
      scope_item_id UUID REFERENCES tender_scope_items(id),
      unit_rate NUMERIC(15,2) DEFAULT 0,
      amount NUMERIC(15,2) DEFAULT 0,
      remarks TEXT
    )
  `);

  // Section B — Bid Opportunities
  await query(`
    CREATE TABLE IF NOT EXISTS bid_opportunities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id),
      project_id UUID REFERENCES projects(id),
      opportunity_number TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_contact TEXT,
      client_email TEXT,
      project_name TEXT NOT NULL,
      project_location TEXT,
      sector TEXT DEFAULT 'other',
      scope_summary TEXT,
      source TEXT DEFAULT 'direct_invite',
      estimated_value NUMERIC(15,2),
      bid_value NUMERIC(15,2),
      win_probability INTEGER DEFAULT 50,
      bid_submission_date DATE,
      submitted_at DATE,
      decision_date DATE,
      status TEXT DEFAULT 'prospect',
      lost_reason TEXT,
      dropped_reason TEXT,
      won_date DATE,
      lost_date DATE,
      bid_manager_id UUID REFERENCES users(id),
      estimator_id UUID REFERENCES users(id),
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, opportunity_number)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS bid_activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL REFERENCES bid_opportunities(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      performed_by UUID REFERENCES users(id),
      performed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS bid_opportunity_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL REFERENCES bid_opportunities(id) ON DELETE CASCADE,
      doc_type TEXT DEFAULT 'general',
      file_name TEXT,
      file_path TEXT,
      file_size INTEGER,
      uploaded_by UUID REFERENCES users(id),
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS bid_cost_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      opportunity_id UUID NOT NULL REFERENCES bid_opportunities(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity NUMERIC(12,3),
      unit TEXT,
      rate NUMERIC(15,2),
      amount NUMERIC(15,2),
      margin_pct NUMERIC(5,2) DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // Add tender-specific columns to bid_opportunities (safe to re-run — IF NOT EXISTS)
  const tenderAlters = [
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS client_tender_ref       TEXT`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS client_type             TEXT DEFAULT 'private'`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS tender_category         TEXT DEFAULT 'works'`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_required            BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_amount              NUMERIC(15,2)`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_mode                TEXT`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_submitted           BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_submitted_date      DATE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_ref_number          TEXT`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS emd_valid_upto          DATE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS pre_bid_date            DATE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS pre_bid_venue           TEXT`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS bid_opening_date        DATE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS financial_opening_date  DATE`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS our_bid_amount          NUMERIC(15,2)`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS our_rank                INTEGER`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS evaluation_remarks      TEXT`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS competitor_info         TEXT`,
    `ALTER TABLE bid_opportunities ADD COLUMN IF NOT EXISTS notice_inviting_tender  TEXT`,
  ];
  for (const sql of tenderAlters) {
    try { await query(sql); } catch (e) { console.warn('[tender] alter skipped:', e.message); }
  }
};
initTable().catch(console.error);

// ═════════════════════════════════════════════════════════════════════════════
// SECTION A — tenderRouter
// ═════════════════════════════════════════════════════════════════════════════
const tenderRouter = express.Router();
tenderRouter.use(authenticate);

// ── GET /tenders — list ───────────────────────────────────────────────────────
tenderRouter.get('/', async (req, res) => {
  try {
    const { status, project_id, tender_type, search } = req.query;
    let sql = `
      SELECT t.*,
             p.name AS project_name,
             v.name AS awarded_vendor_name,
             u.name AS created_by_name,
             (SELECT COUNT(*)::int FROM tender_bids tb WHERE tb.tender_id = t.id) AS bid_count
      FROM tenders t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN vendors  v ON t.awarded_vendor_id = v.id
      LEFT JOIN users    u ON t.created_by = u.id
      WHERE t.company_id = $1
    `;
    const params = [req.user.company_id];
    let i = 2;
    if (status)      { sql += ` AND t.status = $${i++}`;          params.push(status); }
    if (project_id)  { sql += ` AND t.project_id = $${i++}`;      params.push(project_id); }
    if (tender_type) { sql += ` AND t.tender_type = $${i++}`;     params.push(tender_type); }
    if (search)      { sql += ` AND (t.title ILIKE $${i} OR t.tender_number ILIKE $${i})`;
                        params.push(`%${search}%`); i++; }
    sql += ' ORDER BY t.created_at DESC';
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /tenders/stats ────────────────────────────────────────────────────────
tenderRouter.get('/stats', async (req, res) => {
  try {
    const r = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status='draft')       AS draft,
        COUNT(*) FILTER (WHERE status='published')   AS published,
        COUNT(*) FILTER (WHERE status='bid_open')    AS bid_open,
        COUNT(*) FILTER (WHERE status='evaluation')  AS evaluation,
        COUNT(*) FILTER (WHERE status='awarded')     AS awarded,
        COUNT(*) FILTER (WHERE status='cancelled')   AS cancelled,
        COUNT(*)                                     AS total,
        COALESCE(SUM(estimated_value),0)             AS total_estimated,
        COALESCE(SUM(awarded_amount) FILTER (WHERE status='awarded'),0) AS total_awarded
      FROM tenders WHERE company_id=$1
    `, [req.user.company_id]);
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /tenders/:id — full detail ───────────────────────────────────────────
tenderRouter.get('/:id', async (req, res) => {
  try {
    const cid = req.user.company_id, { id } = req.params;
    const tR = await query(`
      SELECT t.*, p.name AS project_name, p.project_code,
             v.name AS awarded_vendor_name,
             u.name AS created_by_name, pu.name AS published_by_name
      FROM tenders t
      LEFT JOIN projects p  ON t.project_id = p.id
      LEFT JOIN vendors  v  ON t.awarded_vendor_id = v.id
      LEFT JOIN users    u  ON t.created_by = u.id
      LEFT JOIN users    pu ON t.published_by = pu.id
      WHERE t.id=$1 AND t.company_id=$2
    `, [id, cid]);
    if (!tR.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const [invVR, scopeR, docsR] = await Promise.all([
      query(`SELECT tiv.*, v.name AS vendor_name, v.contact_person, v.email, v.phone
             FROM tender_invited_vendors tiv JOIN vendors v ON tiv.vendor_id=v.id
             WHERE tiv.tender_id=$1`, [id]),
      query(`SELECT * FROM tender_scope_items WHERE tender_id=$1 ORDER BY sort_order`, [id]),
      query(`SELECT td.*, u.name AS uploaded_by_name FROM tender_documents td
             LEFT JOIN users u ON td.uploaded_by=u.id WHERE td.tender_id=$1 ORDER BY td.uploaded_at DESC`, [id]),
    ]);

    res.json({
      data: {
        ...tR.rows[0],
        invited_vendors: invVR.rows,
        scope_items: scopeR.rows,
        documents: docsR.rows,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /tenders — create ───────────────────────────────────────────────────
tenderRouter.post('/', async (req, res) => {
  try {
    const cid = req.user.company_id;
    const {
      project_id, title, description, scope_of_work, tender_type,
      work_package, estimated_value, emd_required, emd_amount,
      publish_date, bid_open_date, bid_close_date, pre_bid_date,
      expected_start_date, contract_duration,
    } = req.body;

    const result = await withTransaction(async (client) => {
      const tender_number = await nextNumber(client, cid, 'TNR', 'tenders', 'tender_number');
      const r = await client.query(`
        INSERT INTO tenders (
          company_id, project_id, tender_number, title, description, scope_of_work,
          tender_type, work_package, estimated_value, emd_required, emd_amount,
          publish_date, bid_open_date, bid_close_date, pre_bid_date,
          expected_start_date, contract_duration, status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'draft',$18)
        RETURNING *
      `, [cid, project_id||null, tender_number, title, description||null, scope_of_work||null,
          tender_type||'works', work_package||null, estimated_value||null, emd_required||false,
          emd_amount||null, publish_date||null, bid_open_date||null, bid_close_date||null,
          pre_bid_date||null, expected_start_date||null, contract_duration||null, req.user.id]);
      return r.rows[0];
    });
    res.status(201).json({ data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /tenders/:id — update header ─────────────────────────────────────────
tenderRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params, cid = req.user.company_id;
    const fields = ['project_id','title','description','scope_of_work','tender_type','work_package',
                    'estimated_value','emd_required','emd_amount','publish_date','bid_open_date',
                    'bid_close_date','pre_bid_date','expected_start_date','contract_duration'];
    const sets = [], params = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { sets.push(`${f}=$${params.length+1}`); params.push(req.body[f]); }
    });
    if (!sets.length) return res.json({ message: 'Nothing to update' });
    sets.push(`updated_at=NOW()`);
    params.push(id, cid);
    const r = await query(
      `UPDATE tenders SET ${sets.join(',')} WHERE id=$${params.length-1} AND company_id=$${params.length} RETURNING *`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tender not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /tenders/:id — draft only ─────────────────────────────────────────
tenderRouter.delete('/:id', async (req, res) => {
  try {
    const r = await query(
      `DELETE FROM tenders WHERE id=$1 AND company_id=$2 AND status='draft' RETURNING id`,
      [req.params.id, req.user.company_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tender not found or not deletable' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /tenders/:id/publish ────────────────────────────────────────────────
tenderRouter.patch('/:id/publish', async (req, res) => {
  try {
    const r = await query(`
      UPDATE tenders SET status='published', published_by=$1, published_at=NOW(), updated_at=NOW()
      WHERE id=$2 AND company_id=$3 AND status='draft' RETURNING *
    `, [req.user.id, req.params.id, req.user.company_id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Tender not in draft status' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /tenders/:id/open-bids ─────────────────────────────────────────────
tenderRouter.patch('/:id/open-bids', async (req, res) => {
  try {
    const r = await query(`
      UPDATE tenders SET status='bid_open', updated_at=NOW()
      WHERE id=$1 AND company_id=$2 AND status='published' RETURNING *
    `, [req.params.id, req.user.company_id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Tender not in published status' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /tenders/:id/evaluate ──────────────────────────────────────────────
tenderRouter.patch('/:id/evaluate', async (req, res) => {
  try {
    const r = await query(`
      UPDATE tenders SET status='evaluation', updated_at=NOW()
      WHERE id=$1 AND company_id=$2 AND status='bid_open' RETURNING *
    `, [req.params.id, req.user.company_id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Tender not in bid_open status' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /tenders/:id/award ──────────────────────────────────────────────────
tenderRouter.patch('/:id/award', async (req, res) => {
  try {
    const cid = req.user.company_id, { id } = req.params;
    const { bid_id } = req.body;
    if (!bid_id) return res.status(400).json({ error: 'bid_id required' });

    const result = await withTransaction(async (client) => {
      // 1. Validate tender + bid
      const tR = await client.query(
        `SELECT * FROM tenders WHERE id=$1 AND company_id=$2 AND status='evaluation'`,
        [id, cid]
      );
      if (!tR.rows.length) return { error: 'Tender not in evaluation status', code: 400 };
      const tender = tR.rows[0];

      const bR = await client.query(
        `SELECT tb.*, v.name AS vendor_name FROM tender_bids tb
         JOIN vendors v ON tb.vendor_id=v.id
         WHERE tb.id=$1 AND tb.tender_id=$2`,
        [bid_id, id]
      );
      if (!bR.rows.length) return { error: 'Bid not found', code: 404 };
      const bid = bR.rows[0];

      // 2. Mark winning bid
      await client.query(
        `UPDATE tender_bids SET is_winner=true, status='awarded', updated_at=NOW() WHERE id=$1`,
        [bid_id]
      );
      // 3. Reject all other bids
      await client.query(
        `UPDATE tender_bids SET status='rejected', updated_at=NOW()
         WHERE tender_id=$1 AND id<>$2 AND status NOT IN ('rejected')`,
        [id, bid_id]
      );
      // 4. Create PO stub
      const poR = await client.query(`
        INSERT INTO purchase_orders (
          company_id, vendor_id, po_number, description, status, grand_total, notes, created_by
        ) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7) RETURNING id
      `, [
        cid, bid.vendor_id,
        `PO-T-${tender.tender_number}`,
        `From Tender: ${tender.title}`,
        bid.final_amount || bid.bid_amount,
        `Auto-created from Tender ${tender.tender_number} — Award to ${bid.vendor_name}`,
        req.user.id,
      ]);
      const po_id = poR.rows[0].id;

      // 5. Update tender
      await client.query(`
        UPDATE tenders SET
          status='awarded', awarded_bid_id=$1, awarded_vendor_id=$2,
          awarded_amount=$3, award_date=NOW(), po_id=$4, updated_at=NOW()
        WHERE id=$5
      `, [bid_id, bid.vendor_id, bid.final_amount || bid.bid_amount, po_id, id]);

      return { tender_id: id, bid_id, vendor_name: bid.vendor_name, po_id,
               awarded_amount: bid.final_amount || bid.bid_amount };
    });

    if (result.error) return res.status(result.code || 500).json({ error: result.error });
    res.json({ data: result, message: 'Tender awarded successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /tenders/:id/cancel ─────────────────────────────────────────────────
tenderRouter.patch('/:id/cancel', async (req, res) => {
  try {
    const { cancellation_reason } = req.body;
    const r = await query(`
      UPDATE tenders SET status='cancelled', cancellation_reason=$1, updated_at=NOW()
      WHERE id=$2 AND company_id=$3 AND status NOT IN ('awarded','cancelled') RETURNING *
    `, [cancellation_reason||null, req.params.id, req.user.company_id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Tender cannot be cancelled' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Scope Items ──────────────────────────────────────────────────────────────
tenderRouter.get('/:id/scope-items', async (req, res) => {
  try {
    const r = await query(
      `SELECT tsi.* FROM tender_scope_items tsi
       JOIN tenders t ON tsi.tender_id=t.id
       WHERE tsi.tender_id=$1 AND t.company_id=$2
       ORDER BY tsi.sort_order`,
      [req.params.id, req.user.company_id]
    );
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.post('/:id/scope-items', async (req, res) => {
  try {
    const { item_code, description, unit, quantity, sort_order } = req.body;
    // verify ownership
    const tv = await query(`SELECT id FROM tenders WHERE id=$1 AND company_id=$2`, [req.params.id, req.user.company_id]);
    if (!tv.rows.length) return res.status(404).json({ error: 'Tender not found' });
    const r = await query(`
      INSERT INTO tender_scope_items (tender_id, item_code, description, unit, quantity, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [req.params.id, item_code||null, description, unit, quantity||0, sort_order||0]);
    res.status(201).json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.put('/:id/scope-items/:itemId', async (req, res) => {
  try {
    const { item_code, description, unit, quantity, sort_order } = req.body;
    const r = await query(`
      UPDATE tender_scope_items SET
        item_code=$1, description=$2, unit=$3, quantity=$4, sort_order=$5
      WHERE id=$6 AND tender_id=$7
      RETURNING *
    `, [item_code||null, description, unit, quantity||0, sort_order||0,
        req.params.itemId, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.delete('/:id/scope-items/:itemId', async (req, res) => {
  try {
    await query(`DELETE FROM tender_scope_items WHERE id=$1 AND tender_id=$2`,
      [req.params.itemId, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Invited Vendors ──────────────────────────────────────────────────────────
tenderRouter.get('/:id/vendors', async (req, res) => {
  try {
    const r = await query(`
      SELECT tiv.*, v.name AS vendor_name, v.contact_person, v.email, v.phone, v.vendor_code
      FROM tender_invited_vendors tiv
      JOIN vendors v ON tiv.vendor_id=v.id
      JOIN tenders t ON tiv.tender_id=t.id
      WHERE tiv.tender_id=$1 AND t.company_id=$2
      ORDER BY tiv.invited_at DESC
    `, [req.params.id, req.user.company_id]);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.post('/:id/vendors', async (req, res) => {
  try {
    const { vendor_ids } = req.body; // array
    if (!Array.isArray(vendor_ids) || !vendor_ids.length)
      return res.status(400).json({ error: 'vendor_ids array required' });
    const tv = await query(`SELECT id FROM tenders WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    if (!tv.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const inserted = [];
    for (const vid of vendor_ids) {
      try {
        const r = await query(`
          INSERT INTO tender_invited_vendors (tender_id, vendor_id)
          VALUES ($1,$2) ON CONFLICT (tender_id,vendor_id) DO NOTHING RETURNING *
        `, [req.params.id, vid]);
        if (r.rows.length) inserted.push(r.rows[0]);
      } catch (e) { /* skip invalid vendor_id */ }
    }
    res.status(201).json({ data: inserted, inserted_count: inserted.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.delete('/:id/vendors/:vendorId', async (req, res) => {
  try {
    await query(`DELETE FROM tender_invited_vendors WHERE tender_id=$1 AND vendor_id=$2`,
      [req.params.id, req.params.vendorId]);
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Documents ────────────────────────────────────────────────────────────────
tenderRouter.get('/:id/documents', async (req, res) => {
  try {
    const r = await query(`
      SELECT td.*, u.name AS uploaded_by_name
      FROM tender_documents td
      LEFT JOIN users u ON td.uploaded_by=u.id
      JOIN tenders t ON td.tender_id=t.id
      WHERE td.tender_id=$1 AND t.company_id=$2
      ORDER BY td.uploaded_at DESC
    `, [req.params.id, req.user.company_id]);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.post('/:id/documents', uploadTender.array('files', 10), async (req, res) => {
  try {
    const tv = await query(`SELECT id FROM tenders WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    if (!tv.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const { doc_type = 'general' } = req.body;
    const saved = [];
    for (const file of (req.files || [])) {
      const r = await query(`
        INSERT INTO tender_documents (tender_id, doc_type, file_name, file_path, file_size, uploaded_by)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
      `, [req.params.id, doc_type, file.originalname, file.path, file.size, req.user.id]);
      saved.push(r.rows[0]);
    }
    res.status(201).json({ data: saved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const r = await query(`
      DELETE FROM tender_documents WHERE id=$1 AND tender_id=$2 RETURNING file_path
    `, [req.params.docId, req.params.id]);
    if (r.rows[0]?.file_path) {
      try { fs.unlinkSync(r.rows[0].file_path); } catch {}
    }
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Bids ─────────────────────────────────────────────────────────────────────
tenderRouter.get('/:id/bids', async (req, res) => {
  try {
    const r = await query(`
      SELECT tb.*, v.name AS vendor_name, v.contact_person, v.email
      FROM tender_bids tb
      JOIN vendors v ON tb.vendor_id=v.id
      JOIN tenders t ON tb.tender_id=t.id
      WHERE tb.tender_id=$1 AND t.company_id=$2
      ORDER BY COALESCE(tb.final_amount, tb.bid_amount) ASC
    `, [req.params.id, req.user.company_id]);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /tenders/:id/bids/comparison ─────────────────────────────────────────
tenderRouter.get('/:id/bids/comparison', async (req, res) => {
  try {
    const cid = req.user.company_id, { id } = req.params;

    // Validate ownership
    const tV = await query(`SELECT id, title FROM tenders WHERE id=$1 AND company_id=$2`, [id, cid]);
    if (!tV.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const [scopeR, bidsR] = await Promise.all([
      query(`SELECT * FROM tender_scope_items WHERE tender_id=$1 ORDER BY sort_order`, [id]),
      query(`SELECT tb.*, v.name AS vendor_name
             FROM tender_bids tb JOIN vendors v ON tb.vendor_id=v.id
             WHERE tb.tender_id=$1 ORDER BY COALESCE(tb.final_amount,tb.bid_amount) ASC`, [id]),
    ]);
    const scope_items = scopeR.rows;
    const bids = bidsR.rows;

    if (!bids.length) return res.json({ scope_items, bids: [], matrix: {}, l1_analysis: [] });

    // Load bid items for all bids
    const bidIds = bids.map(b => b.id);
    const itemsR = await query(
      `SELECT * FROM tender_bid_items WHERE bid_id = ANY($1::uuid[])`,
      [bidIds]
    );
    const items = itemsR.rows;

    // Build pivot matrix: { scope_item_id: { bid_id: { unit_rate, amount } } }
    const matrix = {};
    for (const si of scope_items) {
      matrix[si.id] = {};
      for (const bid of bids) {
        const item = items.find(i => i.scope_item_id === si.id && i.bid_id === bid.id);
        matrix[si.id][bid.id] = item
          ? { unit_rate: item.unit_rate, amount: item.amount }
          : { unit_rate: null, amount: null };
      }
    }

    // L1 analysis
    const sortedBids = [...bids].sort((a, b) =>
      (parseFloat(a.final_amount || a.bid_amount) || 0) -
      (parseFloat(b.final_amount || b.bid_amount) || 0)
    );
    const l1Amount = parseFloat(sortedBids[0]?.final_amount || sortedBids[0]?.bid_amount) || 0;
    const l1_analysis = sortedBids.map((b, idx) => {
      const amt = parseFloat(b.final_amount || b.bid_amount) || 0;
      return {
        bid_id: b.id,
        vendor_name: b.vendor_name,
        final_amount: amt,
        rank: idx + 1,
        is_l1: idx === 0,
        premium_over_l1_pct: l1Amount > 0 ? +((amt - l1Amount) / l1Amount * 100).toFixed(2) : 0,
        technical_score: b.technical_score,
        financial_score: b.financial_score,
        combined_score: b.combined_score,
        is_winner: b.is_winner,
      };
    });

    res.json({ scope_items, bids, matrix, l1_analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /tenders/:id/bids — submit bid ───────────────────────────────────────
tenderRouter.post('/:id/bids', async (req, res) => {
  try {
    const cid = req.user.company_id, { id } = req.params;
    const {
      vendor_id, bid_reference, submission_date, validity_days,
      bid_amount, discount_pct, mobilisation_advance_pct, retention_pct,
      completion_days, technical_score, financial_score, combined_score,
      emd_submitted, emd_reference, remarks, bid_items = [],
    } = req.body;

    const tV = await query(`SELECT id FROM tenders WHERE id=$1 AND company_id=$2`, [id, cid]);
    if (!tV.rows.length) return res.status(404).json({ error: 'Tender not found' });

    const disc = parseFloat(discount_pct || 0);
    const baseAmt = parseFloat(bid_amount || 0);
    const final_amount = baseAmt - (baseAmt * disc / 100);

    const result = await withTransaction(async (client) => {
      const bR = await client.query(`
        INSERT INTO tender_bids (
          tender_id, vendor_id, company_id, bid_reference, submission_date, validity_days,
          bid_amount, discount_pct, final_amount, mobilisation_advance_pct, retention_pct,
          completion_days, technical_score, financial_score, combined_score,
          emd_submitted, emd_reference, remarks, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'submitted')
        RETURNING *
      `, [id, vendor_id, cid, bid_reference||null, submission_date||null, validity_days||90,
          bid_amount||0, disc, final_amount, mobilisation_advance_pct||null,
          retention_pct||null, completion_days||null, technical_score||null,
          financial_score||null, combined_score||null, emd_submitted||false,
          emd_reference||null, remarks||null]);
      const bid = bR.rows[0];

      // Insert bid items
      for (const item of bid_items) {
        await client.query(`
          INSERT INTO tender_bid_items (bid_id, scope_item_id, unit_rate, amount, remarks)
          VALUES ($1,$2,$3,$4,$5)
        `, [bid.id, item.scope_item_id||null, item.unit_rate||0, item.amount||0, item.remarks||null]);
      }

      // Mark vendor as responded
      await client.query(
        `UPDATE tender_invited_vendors SET responded=true WHERE tender_id=$1 AND vendor_id=$2`,
        [id, vendor_id]
      );

      return bid;
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bid from this vendor already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /tenders/:id/bids/:bidId — update bid / scores ───────────────────────
tenderRouter.put('/:id/bids/:bidId', async (req, res) => {
  try {
    const fields = ['bid_reference','submission_date','validity_days','bid_amount','discount_pct',
                    'final_amount','mobilisation_advance_pct','retention_pct','completion_days',
                    'technical_score','financial_score','combined_score','emd_submitted',
                    'emd_reference','remarks'];
    const sets = [], params = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { sets.push(`${f}=$${params.length+1}`); params.push(req.body[f]); }
    });
    if (!sets.length) return res.json({ message: 'Nothing to update' });
    sets.push('updated_at=NOW()');
    params.push(req.params.bidId, req.params.id);
    const r = await query(
      `UPDATE tender_bids SET ${sets.join(',')} WHERE id=$${params.length-1} AND tender_id=$${params.length} RETURNING *`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Bid not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH shortlist / reject ──────────────────────────────────────────────────
tenderRouter.patch('/:id/bids/:bidId/shortlist', async (req, res) => {
  try {
    const r = await query(
      `UPDATE tender_bids SET status='shortlisted', updated_at=NOW()
       WHERE id=$1 AND tender_id=$2 RETURNING *`,
      [req.params.bidId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Bid not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

tenderRouter.patch('/:id/bids/:bidId/reject', async (req, res) => {
  try {
    const r = await query(
      `UPDATE tender_bids SET status='rejected', remarks=$1, updated_at=NOW()
       WHERE id=$2 AND tender_id=$3 RETURNING *`,
      [req.body.remarks||null, req.params.bidId, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Bid not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═════════════════════════════════════════════════════════════════════════════
// SECTION B — bidRouter (Bid Opportunities)
// ═════════════════════════════════════════════════════════════════════════════
const bidRouter = express.Router();
bidRouter.use(authenticate);

// ── GET /bid-opportunities — list ─────────────────────────────────────────────
bidRouter.get('/', async (req, res) => {
  try {
    const { status, sector, search } = req.query;
    let sql = `
      SELECT bo.*, u.name AS bid_manager_name, e.name AS estimator_name, cb.name AS created_by_name,
             (SELECT COUNT(*)::int FROM bid_activity_log bal WHERE bal.opportunity_id=bo.id) AS activity_count
      FROM bid_opportunities bo
      LEFT JOIN users u  ON bo.bid_manager_id = u.id
      LEFT JOIN users e  ON bo.estimator_id   = e.id
      LEFT JOIN users cb ON bo.created_by     = cb.id
      WHERE bo.company_id = $1
    `;
    const params = [req.user.company_id];
    let i = 2;
    if (status) { sql += ` AND bo.status=$${i++}`; params.push(status); }
    if (sector) { sql += ` AND bo.sector=$${i++}`; params.push(sector); }
    if (search) {
      sql += ` AND (bo.client_name ILIKE $${i} OR bo.project_name ILIKE $${i} OR bo.opportunity_number ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }
    sql += ' ORDER BY bo.created_at DESC';
    const r = await query(sql, params);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /bid-opportunities/stats ──────────────────────────────────────────────
bidRouter.get('/stats', async (req, res) => {
  try {
    const r = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status='prospect')     AS prospect,
        COUNT(*) FILTER (WHERE status='pursuing')     AS pursuing,
        COUNT(*) FILTER (WHERE status='bid_prepared') AS bid_prepared,
        COUNT(*) FILTER (WHERE status='submitted')    AS submitted,
        COUNT(*) FILTER (WHERE status='won')          AS won,
        COUNT(*) FILTER (WHERE status='lost')         AS lost,
        COUNT(*) FILTER (WHERE status='dropped')      AS dropped,
        COUNT(*)                                      AS total,
        COALESCE(SUM(bid_value) FILTER (WHERE status='won'),0)       AS total_won_value,
        COALESCE(SUM(bid_value),0)                                   AS total_pipeline_value,
        ROUND(
          CASE WHEN COUNT(*) FILTER (WHERE status IN ('won','lost')) > 0
               THEN COUNT(*) FILTER (WHERE status='won')::numeric /
                    COUNT(*) FILTER (WHERE status IN ('won','lost')) * 100
               ELSE 0 END, 1
        ) AS win_rate_pct
      FROM bid_opportunities WHERE company_id=$1
    `, [req.user.company_id]);
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /bid-opportunities/:id — full detail ─────────────────────────────────
bidRouter.get('/:id', async (req, res) => {
  try {
    const cid = req.user.company_id, { id } = req.params;
    const r = await query(`
      SELECT bo.*, u.name AS bid_manager_name, e.name AS estimator_name, cb.name AS created_by_name
      FROM bid_opportunities bo
      LEFT JOIN users u  ON bo.bid_manager_id=u.id
      LEFT JOIN users e  ON bo.estimator_id=e.id
      LEFT JOIN users cb ON bo.created_by=cb.id
      WHERE bo.id=$1 AND bo.company_id=$2
    `, [id, cid]);
    if (!r.rows.length) return res.status(404).json({ error: 'Opportunity not found' });

    const [actR, docsR, costR] = await Promise.all([
      query(`SELECT bal.*, u.name AS performed_by_name FROM bid_activity_log bal
             LEFT JOIN users u ON bal.performed_by=u.id
             WHERE bal.opportunity_id=$1 ORDER BY bal.performed_at DESC`, [id]),
      query(`SELECT bod.*, u.name AS uploaded_by_name FROM bid_opportunity_documents bod
             LEFT JOIN users u ON bod.uploaded_by=u.id
             WHERE bod.opportunity_id=$1 ORDER BY bod.uploaded_at DESC`, [id]),
      query(`SELECT * FROM bid_cost_items WHERE opportunity_id=$1 ORDER BY sort_order`, [id]),
    ]);

    res.json({
      data: {
        ...r.rows[0],
        activity_log: actR.rows,
        documents: docsR.rows,
        cost_items: costR.rows,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /bid-opportunities — create ─────────────────────────────────────────
bidRouter.post('/', async (req, res) => {
  try {
    const cid = req.user.company_id;
    const {
      client_name, client_contact, client_email, project_name, project_location,
      sector, scope_summary, source, estimated_value, bid_value, win_probability,
      bid_submission_date, decision_date, bid_manager_id, estimator_id, project_id,
      // Tender-specific fields
      client_tender_ref, client_type, tender_category,
      emd_required, emd_amount, emd_mode, notice_inviting_tender,
    } = req.body;

    const result = await withTransaction(async (client) => {
      const opportunity_number = await nextNumber(client, cid, 'BID', 'bid_opportunities', 'opportunity_number');
      const r = await client.query(`
        INSERT INTO bid_opportunities (
          company_id, project_id, opportunity_number, client_name, client_contact, client_email,
          project_name, project_location, sector, scope_summary, source,
          estimated_value, bid_value, win_probability, bid_submission_date,
          decision_date, bid_manager_id, estimator_id, status, created_by,
          client_tender_ref, client_type, tender_category,
          emd_required, emd_amount, emd_mode, notice_inviting_tender
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'prospect',$19,
                  $20,$21,$22,$23,$24,$25,$26)
        RETURNING *
      `, [cid, project_id||null, opportunity_number, client_name, client_contact||null,
          client_email||null, project_name, project_location||null, sector||'other',
          scope_summary||null, source||'direct_invite', estimated_value||null, bid_value||null,
          win_probability||50, bid_submission_date||null, decision_date||null,
          bid_manager_id||null, estimator_id||null, req.user.id,
          client_tender_ref||null, client_type||'private', tender_category||'works',
          emd_required||false, emd_amount||null, emd_mode||null, notice_inviting_tender||null]);

      const opp = r.rows[0];
      await client.query(`
        INSERT INTO bid_activity_log (opportunity_id, action, to_status, note, performed_by)
        VALUES ($1,'created','prospect','Tender registered', $2)
      `, [opp.id, req.user.id]);

      return opp;
    });
    res.status(201).json({ data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /bid-opportunities/:id — update ──────────────────────────────────────
bidRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params, cid = req.user.company_id;
    const fields = ['client_name','client_contact','client_email','project_name','project_location',
                    'sector','scope_summary','source','estimated_value','bid_value','win_probability',
                    'bid_submission_date','submitted_at','decision_date','bid_manager_id','estimator_id',
                    'lost_reason','dropped_reason','project_id',
                    // Tender-specific
                    'client_tender_ref','client_type','tender_category',
                    'emd_required','emd_amount','emd_mode','emd_submitted','emd_submitted_date',
                    'emd_ref_number','emd_valid_upto','pre_bid_date','pre_bid_venue',
                    'bid_opening_date','financial_opening_date','our_bid_amount','our_rank',
                    'evaluation_remarks','competitor_info','notice_inviting_tender'];
    const sets = [], params = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { sets.push(`${f}=$${params.length+1}`); params.push(req.body[f]); }
    });
    if (!sets.length) return res.json({ message: 'Nothing to update' });
    sets.push('updated_at=NOW()');
    params.push(id, cid);
    const r = await query(
      `UPDATE bid_opportunities SET ${sets.join(',')} WHERE id=$${params.length-1} AND company_id=$${params.length} RETURNING *`,
      params
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Opportunity not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /bid-opportunities/:id — prospect only ────────────────────────────
bidRouter.delete('/:id', async (req, res) => {
  try {
    const r = await query(
      `DELETE FROM bid_opportunities WHERE id=$1 AND company_id=$2 AND status='prospect' RETURNING id`,
      [req.params.id, req.user.company_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Opportunity not found or not deletable' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /bid-opportunities/:id/status — transition ─────────────────────────
bidRouter.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params, cid = req.user.company_id;
    const { status, note, lost_reason, dropped_reason } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const curr = await query(
      `SELECT status FROM bid_opportunities WHERE id=$1 AND company_id=$2`, [id, cid]
    );
    if (!curr.rows.length) return res.status(404).json({ error: 'Opportunity not found' });
    const from_status = curr.rows[0].status;

    const extraSets = [];
    const extraParams = [];
    if (status === 'won')     { extraSets.push(`won_date=NOW()`); }
    if (status === 'lost')    { extraSets.push(`lost_date=NOW()`); if (lost_reason) { extraSets.push(`lost_reason=$${extraParams.length+4}`); extraParams.push(lost_reason); } }
    if (status === 'dropped') { if (dropped_reason) { extraSets.push(`dropped_reason=$${extraParams.length+4}`); extraParams.push(dropped_reason); } }
    if (status === 'submitted') extraSets.push(`submitted_at=CURRENT_DATE`);

    const extraSql = extraSets.length ? `, ${extraSets.join(',')}` : '';
    await query(
      `UPDATE bid_opportunities SET status=$1, updated_at=NOW() ${extraSql} WHERE id=$2 AND company_id=$3`,
      [status, id, cid, ...extraParams]
    );

    // Log activity
    await query(`
      INSERT INTO bid_activity_log (opportunity_id, action, from_status, to_status, note, performed_by)
      VALUES ($1,'status_change',$2,$3,$4,$5)
    `, [id, from_status, status, note||null, req.user.id]);

    const updated = await query(`SELECT * FROM bid_opportunities WHERE id=$1`, [id]);
    res.json({ data: updated.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Documents (Bid Opportunities) ───────────────────────────────────────────
bidRouter.post('/:id/documents', uploadBid.array('files', 10), async (req, res) => {
  try {
    const ov = await query(`SELECT id FROM bid_opportunities WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.user.company_id]);
    if (!ov.rows.length) return res.status(404).json({ error: 'Opportunity not found' });
    const { doc_type = 'general' } = req.body;
    const saved = [];
    for (const file of (req.files || [])) {
      const r = await query(`
        INSERT INTO bid_opportunity_documents (opportunity_id, doc_type, file_name, file_path, file_size, uploaded_by)
        VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
      `, [req.params.id, doc_type, file.originalname, file.path, file.size, req.user.id]);
      saved.push(r.rows[0]);
    }
    res.status(201).json({ data: saved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

bidRouter.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const r = await query(`
      DELETE FROM bid_opportunity_documents WHERE id=$1 AND opportunity_id=$2 RETURNING file_path
    `, [req.params.docId, req.params.id]);
    if (r.rows[0]?.file_path) { try { fs.unlinkSync(r.rows[0].file_path); } catch {} }
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Cost Items ───────────────────────────────────────────────────────────────
bidRouter.get('/:id/cost-items', async (req, res) => {
  try {
    const r = await query(
      `SELECT bci.* FROM bid_cost_items bci
       JOIN bid_opportunities bo ON bci.opportunity_id=bo.id
       WHERE bci.opportunity_id=$1 AND bo.company_id=$2
       ORDER BY bci.sort_order`,
      [req.params.id, req.user.company_id]
    );
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk save (replace all)
bidRouter.post('/:id/cost-items', async (req, res) => {
  try {
    const { id } = req.params, cid = req.user.company_id;
    const ov = await query(`SELECT id FROM bid_opportunities WHERE id=$1 AND company_id=$2`, [id, cid]);
    if (!ov.rows.length) return res.status(404).json({ error: 'Opportunity not found' });

    const { items = [] } = req.body;
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM bid_cost_items WHERE opportunity_id=$1`, [id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO bid_cost_items (opportunity_id, category, description, quantity, unit, rate, amount, margin_pct, sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [id, it.category, it.description, it.quantity||null, it.unit||null,
            it.rate||0, it.amount||0, it.margin_pct||0, i]);
      }
    });
    const r = await query(`SELECT * FROM bid_cost_items WHERE opportunity_id=$1 ORDER BY sort_order`, [id]);
    res.json({ data: r.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

bidRouter.put('/:id/cost-items/:itemId', async (req, res) => {
  try {
    const { category, description, quantity, unit, rate, amount, margin_pct, sort_order } = req.body;
    const r = await query(`
      UPDATE bid_cost_items SET category=$1, description=$2, quantity=$3, unit=$4,
        rate=$5, amount=$6, margin_pct=$7, sort_order=$8
      WHERE id=$9 AND opportunity_id=$10 RETURNING *
    `, [category, description, quantity||null, unit||null, rate||0,
        amount||0, margin_pct||0, sort_order||0, req.params.itemId, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ data: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

bidRouter.delete('/:id/cost-items/:itemId', async (req, res) => {
  try {
    await query(`DELETE FROM bid_cost_items WHERE id=$1 AND opportunity_id=$2`,
      [req.params.itemId, req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { tenderRouter, bidRouter };
