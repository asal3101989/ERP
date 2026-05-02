// TQS Bill Tracker — Local Office Server
// Node.js + Express + sql.js (pure JavaScript SQLite — no Python/compilation needed!)
const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const crypto    = require('crypto');
const https     = require('https');
const { execFile } = require('child_process');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');

const app     = express();
const PORT    = 7001; // TQS Bill Tracker (ConstructERP integration)
const DB_PATH = path.join(__dirname, 'tqs_erp.db');
const PO_EXCEL_TEMPLATE_PATH = path.join(__dirname, 'Templete', 'PO EXCEL TEMEPLTE.xlsx');
const PO_EXCEL_EXPORT_SCRIPT = path.join(__dirname, 'scripts', 'po_excel_export.ps1');

// ── AUTO-BACKUP DIRECTORY ──
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log('[AutoBackup] Created backups directory:', BACKUP_DIR);
}

// ── UPLOADS DIRECTORY (bill scan files stored on disk) ──
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'bills');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('[Uploads] Created uploads directory:', UPLOADS_DIR);
}

// ── SERVER-SIDE SESSIONS ──
// Tokens are random 32-byte hex strings; sessions expire after 8 hours.
const sessions = new Map(); // token → { dept, expiresAt }
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Password hashing — scrypt with per-user salt (no extra dependencies)
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, salt, storedHash) {
  try {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch { return false; }
}

// Purge expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [tok, s] of sessions) {
    if (s.expiresAt < now) sessions.delete(tok);
  }
}, 60 * 60 * 1000);

// Paths that do NOT require a valid session token
const AUTH_EXEMPT = new Set(['/auth/login', '/auth/logout', '/auth/me', '/health', '/projects', '/sync/procurement', '/sync/procurement-grn', '/stock-items']);

function requireAuth(req, res, next) {
  // req.path is relative to the '/api' mount point → e.g. '/auth/login'
  if (AUTH_EXEMPT.has(req.path)) return next();
  // Allow unauthenticated reads of public settings (company branding)
  if (req.path === '/settings' && req.method === 'GET') return next();

  const token = req.headers['x-auth-token'];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token); // remove stale
    return res.status(401).json({ ok: false, error: 'Authentication required. Please log in.' });
  }
  req.dept      = session.dept;
  req.userId    = session.userId;
  req.userName  = session.name;
  req.userEmail = session.email;
  req.projectId = session.projectId || 0;
  next();
}

// Helper: sanitize filename to prevent path traversal
function sanitizeFilename(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._\-() ]/g, '_').substring(0, 200);
}

// Helper: get the folder for a specific SL
function getBillUploadDir(sl) {
  const dir = path.join(UPLOADS_DIR, `SL-${sl}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,X-Auth-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH MIDDLEWARE — applies to all /api/* routes ──
// Exempt paths (login, logout, me, health) bypass the check inside requireAuth.
app.use('/api', requireAuth);

let db;

function saveDb() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.error('═══════════════════════════════════════════════════════');
      console.error('  DATABASE WRITE ERROR — PERMISSION DENIED');
      console.error('  Path:', DB_PATH);
      console.error('');
      console.error('  Fix: Move the tqs-merged folder out of any protected');
      console.error('  location (e.g. Downloads, Program Files, OneDrive).');
      console.error('  Recommended: Place it in C:\\TQS-Server\\');
      console.error('  Then re-run START_SERVER.bat from the new location.');
      console.error('═══════════════════════════════════════════════════════');
    }
    throw err;
  }
}

function query(sql, params) {
  params = params || [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params) {
  db.run(sql, params || []);
}

function mtText(v) {
  return String(v == null ? '' : v).trim();
}

function mtNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function nextMaterialTrackerNo() {
  const row = query(`SELECT tracker_no FROM material_tracker_items
                     WHERE tracker_no LIKE 'MT-%'
                     ORDER BY id DESC LIMIT 1`)[0];
  const current = row ? parseInt(String(row.tracker_no).replace(/[^0-9]/g, ''), 10) || 0 : 0;
  return `MT-${String(current + 1).padStart(5, '0')}`;
}

function computeMaterialTrackerStatus(item) {
  if (mtText(item.certified_invoice_handed_to_accounts)) return 'With Accounts';
  if (mtText(item.invoice_received_by_ho) || mtNum(item.qty_certified_by_qs) || mtNum(item.basic_amount)) return 'Invoice Under Review';
  if (mtText(item.invoice_sent_to_ho_date)) return 'Invoice Forwarded to HO';
  if (mtText(item.invoice_number) || mtText(item.invoice_date) || mtNum(item.invoice_qty) || mtNum(item.material_received_qty)) return 'Material Received';
  if (mtText(item.po_no) || mtText(item.po_date)) return 'PO Raised';
  if (mtText(item.qs_cert_date) || mtText(item.pm_cert_date)) return 'MR Certified';
  if (mtText(item.mr_no) || mtText(item.mr_date)) return 'MR Raised';
  return 'Draft';
}

function materialTrackerAllowedFieldsForDept(dept, isCreate) {
  const storesFields = [
    'project_name', 'project_code', 'team_name', 'head_name', 'responsibility', 'workflow_status',
    'item_code', 'mr_no', 'mr_date', 'pm_cert_date', 'material_required_date', 'item_description', 'unit',
    'mr_qty', 'material_receipt_date_site', 'invoice_number', 'invoice_date',
    'invoice_qty', 'material_received_qty', 'balance_qty_to_be_supplied', 'invoice_sent_to_ho_date',
    'taxes_percent', 'stores_remarks'
  ];
  const procurementFields = [
    'vendor_name', 'po_no', 'po_date', 'procurement_days', 'ordered_qty', 'unit_price',
    'po_gst_pct', 'po_value_basic', 'po_value_with_tax'
  ];
  const qsFields = [
    'qs_cert_date', 'certified_qty',
    'qs_remarks', 'advance_certified_by_qs_finance', 'qty_certified_by_qs', 'rate',
    'basic_amount', 'amount_certified_by_qs_for_payment', 'total_amount_certified_by_qs'
  ];
  const accountsFields = [
    'invoice_received_by_ho', 'cgst', 'sgst', 'igst',
    'mob_advance_deduction', 'tds_other_deduction', 'retention',
    'certified_invoice_handed_to_accounts', 'remarks',
    'advance_voucher_handover', 'recommended_advance_amount', 'advance_certified_by_qs_project',
    'advance_qs_ho_date', 'adv_accounts_receipt_date', 'adv_payment_date',
    'cheque_amount', 'cheque_date', 'vendor_cheque_collect'
  ];
  if (dept === 'admin') return null;
  if (dept === 'stores') return storesFields;
  if (dept === 'procurement') return isCreate ? [] : procurementFields;
  if (dept === 'qs') return isCreate ? [] : qsFields;
  if (dept === 'accounts') return isCreate ? [] : accountsFields;
  return [];
}

function filterMaterialTrackerPayloadByDept(body, dept, isCreate) {
  const allowed = materialTrackerAllowedFieldsForDept(dept, isCreate);
  if (allowed === null) return { ...(body || {}) };
  const filtered = {};
  allowed.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) filtered[key] = body[key];
  });
  return filtered;
}

function normalizeMaterialTrackerPayload(body, meta) {
  const payload = {
    project_id: meta?.projectId || 0,
    project_name: mtText(body.project_name || meta?.projectName || ''),
    project_code: mtText(body.project_code || meta?.projectCode || ''),
    team_name: mtText(body.team_name),
    head_name: mtText(body.head_name),
    responsibility: mtText(body.responsibility),
    item_code: mtText(body.item_code),
    mr_no: mtText(body.mr_no),
    mr_date: mtText(body.mr_date),
    pm_cert_date: mtText(body.pm_cert_date),
    qs_cert_date: mtText(body.qs_cert_date),
    material_required_date: mtText(body.material_required_date),
    item_description: mtText(body.item_description),
    unit: mtText(body.unit),
    mr_qty: mtNum(body.mr_qty),
    certified_qty: mtNum(body.certified_qty),
    vendor_name: mtText(body.vendor_name),
    po_no: mtText(body.po_no),
    po_date: mtText(body.po_date),
    procurement_days: Math.round(mtNum(body.procurement_days)),
    ordered_qty: mtNum(body.ordered_qty),
    unit_price: mtNum(body.unit_price),
    po_gst_pct: mtNum(body.po_gst_pct !== undefined ? body.po_gst_pct : 18),
    po_value_basic: mtNum(body.po_value_basic),
    po_value_with_tax: mtNum(body.po_value_with_tax),
    advance_voucher_handover: mtText(body.advance_voucher_handover),
    recommended_advance_amount: mtNum(body.recommended_advance_amount),
    advance_certified_by_qs_project: mtText(body.advance_certified_by_qs_project),
    advance_qs_ho_date: mtText(body.advance_qs_ho_date),
    adv_accounts_receipt_date: mtText(body.adv_accounts_receipt_date),
    adv_payment_date: mtText(body.adv_payment_date),
    cheque_amount: mtNum(body.cheque_amount),
    cheque_date: mtText(body.cheque_date),
    vendor_cheque_collect: mtText(body.vendor_cheque_collect),
    material_receipt_date_site: mtText(body.material_receipt_date_site),
    invoice_number: mtText(body.invoice_number),
    invoice_date: mtText(body.invoice_date),
    invoice_qty: mtNum(body.invoice_qty),
    material_received_qty: mtNum(body.material_received_qty),
    balance_qty_to_be_supplied: mtNum(body.balance_qty_to_be_supplied),
    invoice_sent_to_ho_date: mtText(body.invoice_sent_to_ho_date),
    taxes_percent: mtNum(body.taxes_percent),
    stores_remarks: mtText(body.stores_remarks),
    qs_remarks: mtText(body.qs_remarks),
    advance_certified_by_qs_finance: mtText(body.advance_certified_by_qs_finance),
    invoice_received_by_ho: mtText(body.invoice_received_by_ho),
    qty_certified_by_qs: mtNum(body.qty_certified_by_qs),
    rate: mtNum(body.rate),
    basic_amount: mtNum(body.basic_amount),
    cgst: mtNum(body.cgst),
    sgst: mtNum(body.sgst),
    igst: mtNum(body.igst),
    mob_advance_deduction: mtNum(body.mob_advance_deduction),
    tds_other_deduction: mtNum(body.tds_other_deduction),
    retention: mtNum(body.retention),
    amount_certified_by_qs_for_payment: mtNum(body.amount_certified_by_qs_for_payment),
    total_amount_certified_by_qs: mtNum(body.total_amount_certified_by_qs),
    certified_invoice_handed_to_accounts: mtText(body.certified_invoice_handed_to_accounts),
    remarks: mtText(body.remarks),
    updated_by: mtText(meta?.userName)
  };
  payload.workflow_status = computeMaterialTrackerStatus(payload);
  return payload;
}

function applyBillLineItemsToInventory(sl, trackerType, lineItems, meta) {
  if (trackerType !== 'po' || !Array.isArray(lineItems) || !lineItems.length) return { synced: 0, skipped: 0 };
  let synced = 0;
  let skipped = 0;
  const txnDate = meta?.txn_date || new Date().toISOString().slice(0, 10);
  for (const raw of lineItems) {
    const itemCode = String(raw.item_code || '').trim();
    const itemName = String(raw.item_name || '').trim();
    const qty = parseFloat(raw.quantity) || 0;
    const rate = parseFloat(raw.rate) || 0;
    if (!itemCode || !qty) { skipped++; continue; }
    const itemRows = query('SELECT * FROM stock_items WHERE item_code=?', [itemCode]);
    if (!itemRows.length) {
      run(`INSERT INTO stock_items (item_code,item_name,category,unit,gst_pct,last_rate,current_qty,current_value)
           VALUES (?,?,?,?,?,?,?,?)`,
        [itemCode, itemName || itemCode, raw.category || '', raw.unit || '',
         parseFloat(raw.gst_pct) || 0, rate, 0, 0]);
    }
    const stock = query('SELECT * FROM stock_items WHERE item_code=?', [itemCode])[0];
    const valueIn = parseFloat((qty * rate).toFixed(2));
    const newQty = (parseFloat(stock.current_qty) || 0) + qty;
    const newVal = (parseFloat(stock.current_value) || 0) + valueIn;
    const newRate = newQty > 0 ? parseFloat((newVal / newQty).toFixed(4)) : rate;
    run(`INSERT INTO stock_ledger
         (item_code,txn_date,txn_type,ref_type,ref_id,bill_sl,qty_in,rate,value_in,balance_qty,balance_value,narration,recorded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [itemCode, txnDate, 'Receipt', 'Bill', sl, sl, qty, rate, valueIn, newQty, newVal,
       `Auto receipt from invoice ${meta?.inv_number || ''}`.trim(), meta?.recorded_by || 'system']);
    run(`UPDATE stock_items
         SET item_name=?, category=?, unit=?, gst_pct=?, current_qty=?, current_value=?, last_rate=?, updated_at=datetime('now','localtime')
         WHERE item_code=?`,
      [itemName || stock.item_name || itemCode, raw.category || stock.category || '', raw.unit || stock.unit || '',
       parseFloat(raw.gst_pct) || parseFloat(stock.gst_pct) || 0, newQty, newVal, newRate, itemCode]);
    synced++;
  }
  return { synced, skipped };
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  run(`CREATE TABLE IF NOT EXISTS bills (
    sl TEXT PRIMARY KEY, vendor TEXT NOT NULL,
    po_number TEXT DEFAULT '', po_date TEXT DEFAULT '',
    inv_number TEXT DEFAULT '', inv_date TEXT DEFAULT '',
    inv_month TEXT DEFAULT '', received_date TEXT DEFAULT '',
    basic_amount REAL DEFAULT 0, gst_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0, credit_note_num TEXT DEFAULT '',
    credit_note_val REAL DEFAULT 0, remarks TEXT DEFAULT '',
    tracker_type TEXT DEFAULT 'po',
    is_new INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  // Migrate existing DBs — add tracker_type if missing, then backfill NULLs
  try { run("ALTER TABLE bills ADD COLUMN tracker_type TEXT DEFAULT 'po'"); } catch(e){}
  run("UPDATE bills SET tracker_type = 'po' WHERE tracker_type IS NULL OR tracker_type = ''")
  // Migrate file_path column (disk-based file storage)
  try { run("ALTER TABLE bill_files ADD COLUMN file_path TEXT DEFAULT ''"); } catch(e){}
  // Migrate additional charge columns
  try { run("ALTER TABLE bills ADD COLUMN transport_charges REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN transport_gst_pct REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN transport_gst_amt REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN other_charges REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN other_charges_desc TEXT DEFAULT ''"); } catch(e){}
  // BuildPro procurement integration — track synced invoices
  try { run("ALTER TABLE bills ADD COLUMN buildpro_ref TEXT DEFAULT ''"); } catch(e){}
  // Migrate GST breakdown columns (CGST / SGST / IGST)
  try { run("ALTER TABLE bills ADD COLUMN cgst_pct REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN cgst_amt REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN sgst_pct REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN sgst_amt REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN igst_pct REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bills ADD COLUMN igst_amt REAL DEFAULT 0"); } catch(e){}
  // Migrate WO deduction columns
  try { run("ALTER TABLE bill_updates ADD COLUMN retention_money REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN tds_deduction REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN other_deductions REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN dc_number TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN vehicle_number TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN inspection_status TEXT DEFAULT 'Accepted'"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN shortage_flag INTEGER DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN storage_location TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE bill_updates ADD COLUMN received_by TEXT DEFAULT ''"); } catch(e){}

  run(`CREATE TABLE IF NOT EXISTS bill_updates (
    sl TEXT PRIMARY KEY,
    store_handover_date TEXT DEFAULT '', store_recv_date TEXT DEFAULT '',
    store_remarks TEXT DEFAULT '', ho_received_date TEXT DEFAULT '',
    qs_received_date TEXT DEFAULT '', doc_ctrl_remarks TEXT DEFAULT '',
    qs_certified_date TEXT DEFAULT '', qs_gross REAL DEFAULT 0,
    qs_tax REAL DEFAULT 0, qs_total REAL DEFAULT 0,
    advance_recovered REAL DEFAULT 0, credit_note_amt REAL DEFAULT 0,
    retention_money REAL DEFAULT 0, tds_deduction REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    total_deductions REAL DEFAULT 0, certified_net REAL DEFAULT 0,
    payment_cert TEXT DEFAULT '', qs_remarks TEXT DEFAULT '',
    proc_date TEXT DEFAULT '', proc_verify_date TEXT DEFAULT '',
    proc_received_date TEXT DEFAULT '', mgmt_approval_date TEXT DEFAULT '',
    proc_remarks TEXT DEFAULT '', accts_jv_date TEXT DEFAULT '',
    accts_dept1 TEXT DEFAULT '', accts_dept2 TEXT DEFAULT '',
    transfer_status TEXT DEFAULT '', accts_remarks TEXT DEFAULT '',
    transferred INTEGER DEFAULT 0, payment_status TEXT DEFAULT '',
    paid_amount REAL DEFAULT 0, balance_to_pay REAL DEFAULT 0,
    payment_date TEXT DEFAULT '', ai_summary TEXT DEFAULT '',
    ai_warnings TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS bill_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sl TEXT NOT NULL, dept TEXT DEFAULT '',
    action TEXT DEFAULT '',
    ts TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS bill_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sl TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '',
    type TEXT DEFAULT '',
    data TEXT NOT NULL,
    uploaded_by TEXT DEFAULT '',
    uploaded_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    trade_name TEXT DEFAULT '',
    contact_person TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    gstin TEXT DEFAULT '',
    pan TEXT DEFAULT '',
    trade_license TEXT DEFAULT '',
    msme_reg TEXT DEFAULT '',
    vendor_type TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    bank_account TEXT DEFAULT '',
    bank_ifsc TEXT DEFAULT '',
    bank_branch TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);


  // ── PO LIFECYCLE TABLES ──
  run(`CREATE TABLE IF NOT EXISTS purchase_orders (
    po_number TEXT PRIMARY KEY,
    vendor TEXT NOT NULL,
    po_date TEXT DEFAULT '',
    po_value REAL DEFAULT 0,
    description TEXT DEFAULT '',
    site_code TEXT DEFAULT '',
    tracker_type TEXT DEFAULT 'po',
    status TEXT DEFAULT 'Active',
    approved_by TEXT DEFAULT '',
    approval_date TEXT DEFAULT '',
    amendment_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS po_amendments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL,
    amendment_no INTEGER DEFAULT 1,
    original_value REAL DEFAULT 0,
    revised_value REAL DEFAULT 0,
    reason TEXT DEFAULT '',
    amended_by TEXT DEFAULT '',
    amendment_date TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS grn_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL,
    bill_sl TEXT DEFAULT '',
    grn_date TEXT DEFAULT '',
    grn_value REAL DEFAULT 0,
    received_by TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS po_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number TEXT NOT NULL,
    sl_no INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    uom TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    gst_pct REAL DEFAULT 18,
    gst_amt REAL DEFAULT 0,
    total_amt REAL DEFAULT 0,
    heads TEXT DEFAULT ''
  )`);
  try { run("ALTER TABLE po_items ADD COLUMN gst_pct REAL DEFAULT 18"); } catch(e){}
  try { run("ALTER TABLE po_items ADD COLUMN gst_amt REAL DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE po_items ADD COLUMN total_amt REAL DEFAULT 0"); } catch(e){}

  // Migrate: add new company settings columns (safe - already key/value store)
  // Ensure po_items exists on upgrade
  try { run("ALTER TABLE purchase_orders ADD COLUMN po_req_no TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN po_req_date TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN approval_no TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN delivery_address TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN delivery_contact TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN narration TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN form_no TEXT DEFAULT 'BCIM-PUR-F-03'"); } catch(e){}

  // ── MATERIAL TRACKER MIGRATIONS ────────────────────────────────────────────
  try { run("ALTER TABLE material_tracker_items ADD COLUMN item_code TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE material_tracker_items ADD COLUMN pm_cert_date TEXT DEFAULT ''"); } catch(e){}
  try { run("ALTER TABLE material_tracker_items ADD COLUMN po_gst_pct REAL DEFAULT 18"); } catch(e){}


  // ── INVENTORY & INDENT TABLES ──────────────────────────────────────────────
  run(`CREATE TABLE IF NOT EXISTS stock_items (
    item_code TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    gst_pct REAL DEFAULT 18,
    reorder_qty REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    current_qty REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    last_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
  try { run("ALTER TABLE stock_items ADD COLUMN gst_pct REAL DEFAULT 18"); } catch(e){}

  run(`CREATE TABLE IF NOT EXISTS material_indents (
    indent_no TEXT PRIMARY KEY,
    raised_by TEXT DEFAULT '',
    raised_date TEXT DEFAULT (date('now','localtime')),
    site_code TEXT DEFAULT '',
    purpose TEXT DEFAULT '',
    required_date TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending Stores',
    stores_checked_by TEXT DEFAULT '',
    stores_checked_date TEXT DEFAULT '',
    stores_remarks TEXT DEFAULT '',
    qs_approved_by TEXT DEFAULT '',
    qs_approved_date TEXT DEFAULT '',
    qs_remarks TEXT DEFAULT '',
    pm_approved_by TEXT DEFAULT '',
    pm_approved_date TEXT DEFAULT '',
    pm_remarks TEXT DEFAULT '',
    md_approved_by TEXT DEFAULT '',
    md_approved_date TEXT DEFAULT '',
    md_remarks TEXT DEFAULT '',
    po_number TEXT DEFAULT '',
    closed_date TEXT DEFAULT '',
    tracker_type TEXT DEFAULT 'po',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS indent_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    indent_no TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    qty_requested REAL DEFAULT 0,
    qty_approved REAL DEFAULT 0,
    qty_issued REAL DEFAULT 0,
    qty_ordered REAL DEFAULT 0,
    est_rate REAL DEFAULT 0,
    est_value REAL DEFAULT 0,
    remarks TEXT DEFAULT ''
  )`);

  run(`CREATE TABLE IF NOT EXISTS material_tracker_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracker_id INTEGER NOT NULL,
    sl_no INTEGER DEFAULT 1,
    item_code TEXT DEFAULT '',
    description TEXT DEFAULT '',
    uom TEXT DEFAULT 'Nos',
    qty REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    basic_amt REAL DEFAULT 0,
    gst_pct REAL DEFAULT 18,
    gst_amt REAL DEFAULT 0,
    total_amt REAL DEFAULT 0,
    head_name TEXT DEFAULT '',
    project_id INTEGER DEFAULT 0
  )`);

  run(`CREATE TABLE IF NOT EXISTS material_tracker_heads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS material_tracker_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS material_tracker_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracker_no TEXT NOT NULL UNIQUE,
    project_id INTEGER DEFAULT 0,
    project_name TEXT DEFAULT '',
    project_code TEXT DEFAULT '',
    team_name TEXT DEFAULT '',
    head_name TEXT DEFAULT '',
    responsibility TEXT DEFAULT '',
    item_code TEXT DEFAULT '',
    mr_no TEXT DEFAULT '',
    mr_date TEXT DEFAULT '',
    pm_cert_date TEXT DEFAULT '',
    qs_cert_date TEXT DEFAULT '',
    material_required_date TEXT DEFAULT '',
    item_description TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    mr_qty REAL DEFAULT 0,
    certified_qty REAL DEFAULT 0,
    vendor_name TEXT DEFAULT '',
    po_no TEXT DEFAULT '',
    po_date TEXT DEFAULT '',
    procurement_days INTEGER DEFAULT 0,
    ordered_qty REAL DEFAULT 0,
    unit_price REAL DEFAULT 0,
    po_gst_pct REAL DEFAULT 18,
    po_value_basic REAL DEFAULT 0,
    po_value_with_tax REAL DEFAULT 0,
    advance_voucher_handover TEXT DEFAULT '',
    recommended_advance_amount REAL DEFAULT 0,
    advance_certified_by_qs_project TEXT DEFAULT '',
    advance_qs_ho_date TEXT DEFAULT '',
    adv_accounts_receipt_date TEXT DEFAULT '',
    adv_payment_date TEXT DEFAULT '',
    cheque_amount REAL DEFAULT 0,
    cheque_date TEXT DEFAULT '',
    vendor_cheque_collect TEXT DEFAULT '',
    material_receipt_date_site TEXT DEFAULT '',
    invoice_number TEXT DEFAULT '',
    invoice_date TEXT DEFAULT '',
    invoice_qty REAL DEFAULT 0,
    material_received_qty REAL DEFAULT 0,
    balance_qty_to_be_supplied REAL DEFAULT 0,
    invoice_sent_to_ho_date TEXT DEFAULT '',
    taxes_percent REAL DEFAULT 0,
    stores_remarks TEXT DEFAULT '',
    qs_remarks TEXT DEFAULT '',
    advance_certified_by_qs_finance TEXT DEFAULT '',
    invoice_received_by_ho TEXT DEFAULT '',
    qty_certified_by_qs REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    basic_amount REAL DEFAULT 0,
    cgst REAL DEFAULT 0,
    sgst REAL DEFAULT 0,
    igst REAL DEFAULT 0,
    mob_advance_deduction REAL DEFAULT 0,
    tds_other_deduction REAL DEFAULT 0,
    retention REAL DEFAULT 0,
    amount_certified_by_qs_for_payment REAL DEFAULT 0,
    total_amount_certified_by_qs REAL DEFAULT 0,
    certified_invoice_handed_to_accounts TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    workflow_status TEXT DEFAULT 'Draft',
    is_deleted INTEGER DEFAULT 0,
    created_by TEXT DEFAULT '',
    updated_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  const defaultMaterialTeams = [
    { name: 'Project Team', code: 'PROJECT_TEAM', sort_order: 1 },
    { name: 'Procurement Department', code: 'PROCUREMENT', sort_order: 2 },
    { name: 'QS Department', code: 'QS', sort_order: 3 },
    { name: 'Finance', code: 'FINANCE', sort_order: 4 }
  ];
  defaultMaterialTeams.forEach(team => {
    run(`INSERT OR IGNORE INTO material_tracker_teams (name, code, sort_order)
         VALUES (?,?,?)`, [team.name, team.code, team.sort_order]);
  });

  const defaultMaterialHeads = [
    { name: 'Material',       code: 'MATERIAL',      sort_order: 1 },
    { name: 'Consumables',    code: 'CONSUMABLES',   sort_order: 2 },
    { name: 'Equipment',      code: 'EQUIPMENT',     sort_order: 3 },
    { name: 'Tools',          code: 'TOOLS',         sort_order: 4 },
    { name: 'Safety Items',   code: 'SAFETY',        sort_order: 5 },
    { name: 'Civil',          code: 'CIVIL',         sort_order: 6 },
    { name: 'Electrical',     code: 'ELECTRICAL',    sort_order: 7 },
    { name: 'Mechanical',     code: 'MECHANICAL',    sort_order: 8 },
    { name: 'IT & Systems',   code: 'IT_SYSTEMS',    sort_order: 9 },
    { name: 'Miscellaneous',  code: 'MISC',          sort_order: 10 }
  ];
  defaultMaterialHeads.forEach(h => {
    run(`INSERT OR IGNORE INTO material_tracker_heads (name, code, sort_order)
         VALUES (?,?,?)`, [h.name, h.code, h.sort_order]);
  });

  run(`CREATE TABLE IF NOT EXISTS stock_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT NOT NULL,
    txn_date TEXT DEFAULT (date('now','localtime')),
    txn_type TEXT DEFAULT '',
    ref_type TEXT DEFAULT '',
    ref_id TEXT DEFAULT '',
    indent_no TEXT DEFAULT '',
    bill_sl TEXT DEFAULT '',
    qty_in REAL DEFAULT 0,
    qty_out REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    value_in REAL DEFAULT 0,
    value_out REAL DEFAULT 0,
    balance_qty REAL DEFAULT 0,
    balance_value REAL DEFAULT 0,
    narration TEXT DEFAULT '',
    recorded_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS bill_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sl TEXT NOT NULL,
    item_code TEXT DEFAULT '',
    item_name TEXT DEFAULT '',
    category TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    rate REAL DEFAULT 0,
    basic_amount REAL DEFAULT 0,
    gst_pct REAL DEFAULT 0,
    gst_mode TEXT DEFAULT 'intrastate',
    cgst_pct REAL DEFAULT 0,
    cgst_amt REAL DEFAULT 0,
    sgst_pct REAL DEFAULT 0,
    sgst_amt REAL DEFAULT 0,
    igst_pct REAL DEFAULT 0,
    igst_amt REAL DEFAULT 0,
    gst_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // ── PROJECTS TABLE ──
  run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#2563eb',
    icon TEXT DEFAULT '🏗️',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Seed default projects if none exist
  const projCount = query('SELECT COUNT(*) as c FROM projects')[0].c;
  if (!projCount) {
    run(`INSERT INTO projects (name, code, color, icon) VALUES ('Godrej-Ascend', 'GODREJ', '#2563eb', '🏗️')`);
    run(`INSERT INTO projects (name, code, color, icon) VALUES ('TQS-Bengaluru', 'TQS-BLR', '#059669', '🏢')`);
    console.log('[Projects] Seeded 2 default projects');
  }

  // Rename legacy placeholder projects to actual project names (one-time migration)
  try {
    run(`UPDATE projects SET name='Godrej-Ascend', code='GODREJ' WHERE code='PROJ-A'`);
    run(`UPDATE projects SET name='TQS-Bengaluru', code='TQS-BLR' WHERE code='PROJ-B'`);
    run(`UPDATE projects SET is_active=0 WHERE code='PROJ-C'`);
  } catch(e) {}

  // Migrate project_id into main data tables
  try { run("ALTER TABLE bills ADD COLUMN project_id INTEGER DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE purchase_orders ADD COLUMN project_id INTEGER DEFAULT 0"); } catch(e){}
  try { run("ALTER TABLE material_indents ADD COLUMN project_id INTEGER DEFAULT 0"); } catch(e){}

  // Assign all existing unassigned data (project_id=0) to TQS-Bengaluru
  const tqsProj = query(`SELECT id FROM projects WHERE code='TQS-BLR' LIMIT 1`);
  if (tqsProj.length) {
    const tqsId = tqsProj[0].id;
    run(`UPDATE bills SET project_id=? WHERE project_id=0 OR project_id IS NULL`, [tqsId]);
    run(`UPDATE bills SET project_id=? WHERE project_id=1 AND buildpro_ref != ''`, [tqsId]);
    run(`UPDATE purchase_orders SET project_id=? WHERE project_id=0 OR project_id IS NULL`, [tqsId]);
    run(`UPDATE material_indents SET project_id=? WHERE project_id=0 OR project_id IS NULL`, [tqsId]);
    console.log(`[Migration] Assigned existing/orphaned syncs to TQS-Bengaluru (id=${tqsId})`);
  }

  // ── USER-PROJECTS JUNCTION TABLE ──
  run(`CREATE TABLE IF NOT EXISTS user_projects (
    user_id    INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, project_id)
  )`);

  // Assign all existing users to TQS-Bengaluru by default (if not yet assigned)
  const tqsRow = query(`SELECT id FROM projects WHERE code='TQS-BLR' LIMIT 1`);
  if (tqsRow.length) {
    const tqsId = tqsRow[0].id;
    const allUsers = query('SELECT id FROM users');
    allUsers.forEach(u => {
      run('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?,?)', [u.id, tqsId]);
    });
  }

  // ── USERS TABLE ──
  run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    dept TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  run(`CREATE TABLE IF NOT EXISTS invoice_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER DEFAULT 0,
    bill_sl TEXT DEFAULT '',
    invoice_number TEXT DEFAULT '',
    po_number TEXT DEFAULT '',
    subject TEXT DEFAULT '',
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_by_id INTEGER DEFAULT 0,
    created_by_name TEXT DEFAULT '',
    created_by_email TEXT DEFAULT '',
    created_by_dept TEXT DEFAULT '',
    resolved_by_id INTEGER DEFAULT 0,
    resolved_by_name TEXT DEFAULT '',
    resolved_at TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Seed one default account per department if none exist yet
  const userCount = query('SELECT COUNT(*) as c FROM users')[0].c;
  if (!userCount) {
    const defaultPass = 'TQS@1234';
    const defaultUsers = [
      { email: 'stores@tqs.local',      name: 'Stores User',      dept: 'stores' },
      { email: 'docctrl@tqs.local',     name: 'Doc Controller',   dept: 'doc_ctrl' },
      { email: 'qs@tqs.local',          name: 'Qty Surveyor',     dept: 'qs' },
      { email: 'procurement@tqs.local', name: 'Procurement User', dept: 'procurement' },
      { email: 'accounts@tqs.local',    name: 'Accounts User',    dept: 'accounts' },
      { email: 'admin@tqs.local',       name: 'Administrator',    dept: 'admin' },
    ];
    defaultUsers.forEach(u => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(defaultPass, salt);
      run(`INSERT INTO users (email, name, dept, password_hash, salt) VALUES (?,?,?,?,?)`,
        [u.email, u.name, u.dept, hash, salt]);
    });
    console.log('[Auth] Seeded 6 default user accounts (password: TQS@1234)');
  }

  saveDb();
  console.log('Tables ready');
}

// ── AUTH ENDPOINTS ──

// POST /api/auth/login — verify email + password + project, return session token
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, project_id } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }
    if (!project_id) {
      return res.status(400).json({ ok: false, error: 'Please select a project to continue' });
    }
    const projectRows = query('SELECT * FROM projects WHERE id=? AND is_active=1', [project_id]);
    if (!projectRows.length) {
      return res.status(400).json({ ok: false, error: 'Invalid or inactive project' });
    }
    const project = projectRows[0];
    const rows = query('SELECT * FROM users WHERE LOWER(email)=LOWER(?) AND is_active=1', [email.trim()]);
    if (!rows.length || !verifyPassword(password, rows[0].salt, rows[0].password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }
    const user = rows[0];
    // Check project access (admin can access all projects)
    if (user.dept !== 'admin') {
      const access = query('SELECT 1 FROM user_projects WHERE user_id=? AND project_id=?', [user.id, project.id]);
      if (!access.length) {
        return res.status(403).json({ ok: false, error: `You don't have access to ${project.name}` });
      }
    }
    const token = generateToken();
    sessions.set(token, {
      dept: user.dept, userId: user.id, name: user.name, email: user.email,
      projectId: project.id, projectName: project.name,
      expiresAt: Date.now() + SESSION_TTL_MS
    });
    res.json({ ok: true, token, dept: user.dept, name: user.name, email: user.email, userId: user.id,
               projectId: project.id, projectName: project.name });
  } catch (err) {
    console.error('[Login error]', err.message);
    res.status(500).json({ ok: false, error: 'Server error: ' + err.message });
  }
});

// POST /api/auth/logout — invalidate session token
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// GET /api/auth/me — validate token and return current user info
app.get('/api/auth/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (session) sessions.delete(token);
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }
  res.json({ ok: true, dept: session.dept, name: session.name, email: session.email, userId: session.userId,
             projectId: session.projectId || 0, projectName: session.projectName || '' });
});

// ── PROJECT ENDPOINTS ──

// GET /api/projects — public, used on login page
app.get('/api/projects', (req, res) => {
  try {
    const projects = query('SELECT id, name, code, color, icon FROM projects WHERE is_active=1 ORDER BY id');
    res.json({ ok: true, projects });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/projects — admin only, create project
app.post('/api/projects', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const { name, code, color, icon } = req.body;
    if (!name || !code) return res.status(400).json({ ok: false, error: 'name and code required' });
    const exists = query('SELECT id FROM projects WHERE LOWER(code)=LOWER(?)', [code]);
    if (exists.length) return res.status(409).json({ ok: false, error: 'Project code already exists' });
    run(`INSERT INTO projects (name, code, color, icon) VALUES (?,?,?,?)`,
      [name, code, color||'#2563eb', icon||'🏗️']);
    saveDb();
    const proj = query('SELECT * FROM projects WHERE LOWER(code)=LOWER(?)', [code])[0];
    res.json({ ok: true, project: proj });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/projects/:id — admin only, update project
app.patch('/api/projects/:id', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const { name, color, icon, is_active } = req.body;
    const fields = [], vals = [];
    if (name      !== undefined) { fields.push('name=?');      vals.push(name); }
    if (color     !== undefined) { fields.push('color=?');     vals.push(color); }
    if (icon      !== undefined) { fields.push('icon=?');      vals.push(icon); }
    if (is_active !== undefined) { fields.push('is_active=?'); vals.push(is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ ok: false, error: 'No fields to update' });
    vals.push(req.params.id);
    run(`UPDATE projects SET ${fields.join(',')} WHERE id=?`, vals);
    saveDb();
    res.json({ ok: true });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── USER MANAGEMENT ENDPOINTS (admin only) ──

// GET /api/users
app.get('/api/users', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  const users = query('SELECT id,email,name,dept,is_active,created_at FROM users ORDER BY dept,name');
  users.forEach(u => {
    const projs = query('SELECT project_id FROM user_projects WHERE user_id=?', [u.id]);
    u.project_ids = projs.map(p => p.project_id);
  });
  res.json({ ok: true, users });
});

// POST /api/users
app.post('/api/users', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  const { email, name, dept, password, project_ids } = req.body || {};
  if (!email || !name || !dept || !password) {
    return res.status(400).json({ ok: false, error: 'email, name, dept, and password are required' });
  }
  const validDepts = ['stores','doc_ctrl','qs','procurement','accounts','admin'];
  if (!validDepts.includes(dept)) return res.status(400).json({ ok: false, error: 'Invalid department' });
  const existing = query('SELECT id FROM users WHERE LOWER(email)=LOWER(?)', [email.trim()]);
  if (existing.length) return res.status(409).json({ ok: false, error: 'Email already in use' });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  run(`INSERT INTO users (email,name,dept,password_hash,salt) VALUES (?,?,?,?,?)`,
    [email.trim().toLowerCase(), name.trim(), dept, hash, salt]);
  const id = query('SELECT last_insert_rowid() as id')[0].id;
  if (Array.isArray(project_ids)) {
    project_ids.forEach(pid => {
      run('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?,?)', [id, pid]);
    });
  }
  saveDb();
  res.json({ ok: true, id });
});

// PUT /api/users/:id — partial update (only fields present in body are changed)
app.put('/api/users/:id', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  const { name, dept, password, is_active, project_ids } = req.body || {};
  const { id } = req.params;
  const sets = [], params = [];
  if (name !== undefined)      { sets.push('name=?');      params.push(name || ''); }
  if (dept !== undefined)      { sets.push('dept=?');      params.push(dept || ''); }
  if (is_active !== undefined) { sets.push('is_active=?'); params.push(is_active ? 1 : 0); }
  if (password && password.trim()) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    sets.push('password_hash=?'); params.push(hash);
    sets.push('salt=?');          params.push(salt);
  }
  if (sets.length) {
    sets.push("updated_at=datetime('now','localtime')");
    params.push(id);
    run(`UPDATE users SET ${sets.join(',')} WHERE id=?`, params);
  }
  if (Array.isArray(project_ids)) {
    run('DELETE FROM user_projects WHERE user_id=?', [id]);
    project_ids.forEach(pid => {
      run('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?,?)', [id, pid]);
    });
  }
  saveDb();
  res.json({ ok: true });
});

// DELETE /api/users/:id — soft-delete
app.delete('/api/users/:id', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  run(`UPDATE users SET is_active=0,updated_at=datetime('now','localtime') WHERE id=?`, [req.params.id]);
  saveDb();
  res.json({ ok: true });
});

// GET /api/invoice-requests
app.get('/api/invoice-requests', (req, res) => {
  try {
    const status = String(req.query.status || 'all').trim().toLowerCase();
    const params = [req.projectId || 0];
    let where = 'WHERE project_id=?';
    if (req.dept !== 'admin') {
      where += ' AND created_by_id=?';
      params.push(req.userId || 0);
    }
    if (status === 'open' || status === 'resolved') {
      where += ' AND status=?';
      params.push(status);
    }
    const requests = query(
      `SELECT id, project_id, bill_sl, invoice_number, po_number, subject, message, status,
              created_by_id, created_by_name, created_by_email, created_by_dept,
              resolved_by_id, resolved_by_name, resolved_at, created_at, updated_at
         FROM invoice_requests
         ${where}
         ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END, datetime(created_at) DESC, id DESC`,
      params
    );
    res.json({ ok: true, requests });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/invoice-requests
app.post('/api/invoice-requests', (req, res) => {
  try {
    const body = req.body || {};
    const message = String(body.message || '').trim();
    if (!message) return res.status(400).json({ ok: false, error: 'Message is required' });

    run(
      `INSERT INTO invoice_requests
       (project_id,bill_sl,invoice_number,po_number,subject,message,status,
        created_by_id,created_by_name,created_by_email,created_by_dept)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.projectId || 0,
        String(body.bill_sl || '').trim(),
        String(body.invoice_number || '').trim(),
        String(body.po_number || '').trim(),
        String(body.subject || 'Invoice update request').trim().slice(0, 140) || 'Invoice update request',
        message,
        'open',
        req.userId || 0,
        req.userName || '',
        req.userEmail || '',
        req.dept || ''
      ]
    );
    saveDb();
    const requestId = query('SELECT MAX(id) as id FROM invoice_requests')[0]?.id;
    const request = requestId ? query('SELECT * FROM invoice_requests WHERE id=?', [requestId])[0] : null;
    res.json({ ok: true, request });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/invoice-requests/:id
app.patch('/api/invoice-requests/:id', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const id = parseInt(req.params.id, 10);
    const status = String((req.body || {}).status || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid request id' });
    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Status must be open or resolved' });
    }
    const existing = query('SELECT id FROM invoice_requests WHERE id=? AND project_id=?', [id, req.projectId || 0]);
    if (!existing.length) return res.status(404).json({ ok: false, error: 'Request not found' });

    run(
      `UPDATE invoice_requests
          SET status=?,
              resolved_by_id=?,
              resolved_by_name=?,
              resolved_at=?,
              updated_at=datetime('now','localtime')
        WHERE id=?`,
      [
        status,
        status === 'resolved' ? (req.userId || 0) : 0,
        status === 'resolved' ? (req.userName || '') : '',
        status === 'resolved' ? new Date().toISOString() : '',
        id
      ]
    );
    saveDb();
    const request = query('SELECT * FROM invoice_requests WHERE id=?', [id])[0];
    res.json({ ok: true, request });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── VENDOR ENDPOINTS ──

// GET /api/vendors
app.get('/api/vendors', (req, res) => {
  try {
    const vendors = query('SELECT * FROM vendors WHERE is_active=1 ORDER BY name ASC');
    res.json({ ok: true, vendors });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/vendors — create
app.post('/api/vendors', (req, res) => {
  try {
    const d = req.body;
    if (!d.name || !d.name.trim()) return res.status(400).json({ ok: false, error: 'Vendor name required' });
    const existing = query('SELECT id FROM vendors WHERE LOWER(name)=LOWER(?)', [d.name.trim()]);
    if (existing.length) return res.status(409).json({ ok: false, error: 'Vendor already exists: ' + d.name.trim() });
    run(`INSERT INTO vendors (name,trade_name,contact_person,phone,email,address,city,state,pincode,
         gstin,pan,trade_license,msme_reg,vendor_type,bank_name,bank_account,bank_ifsc,bank_branch,notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.name.trim(),d.trade_name||'',d.contact_person||'',d.phone||'',d.email||'',
       d.address||'',d.city||'',d.state||'',d.pincode||'',
       d.gstin||'',d.pan||'',d.trade_license||'',d.msme_reg||'',d.vendor_type||'',
       d.bank_name||'',d.bank_account||'',d.bank_ifsc||'',d.bank_branch||'',d.notes||'']);
    const id = query('SELECT last_insert_rowid() as id')[0].id;
    saveDb();
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PUT /api/vendors/:id — update
app.put('/api/vendors/:id', (req, res) => {
  try {
    const d = req.body;
    const { id } = req.params;
    if (!d.name || !d.name.trim()) return res.status(400).json({ ok: false, error: 'Vendor name required' });
    const dup = query('SELECT id FROM vendors WHERE LOWER(name)=LOWER(?) AND id!=?', [d.name.trim(), id]);
    if (dup.length) return res.status(409).json({ ok: false, error: 'Another vendor with this name already exists' });
    run(`UPDATE vendors SET name=?,trade_name=?,contact_person=?,phone=?,email=?,address=?,city=?,state=?,
         pincode=?,gstin=?,pan=?,trade_license=?,msme_reg=?,vendor_type=?,bank_name=?,bank_account=?,
         bank_ifsc=?,bank_branch=?,notes=?,updated_at=datetime('now','localtime') WHERE id=?`,
      [d.name.trim(),d.trade_name||'',d.contact_person||'',d.phone||'',d.email||'',
       d.address||'',d.city||'',d.state||'',d.pincode||'',
       d.gstin||'',d.pan||'',d.trade_license||'',d.msme_reg||'',d.vendor_type||'',
       d.bank_name||'',d.bank_account||'',d.bank_ifsc||'',d.bank_branch||'',d.notes||'',id]);
    saveDb();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/vendors/:id — soft delete
app.delete('/api/vendors/:id', (req, res) => {
  try {
    run('UPDATE vendors SET is_active=0 WHERE id=?', [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ── APP SETTINGS ENDPOINTS ──

// GET /api/settings — returns all settings as flat object
app.get('/api/settings', (req, res) => {
  try {
    const rows = query('SELECT key, value FROM app_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ ok: true, settings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/settings — upsert one or many key/value pairs
app.put('/api/settings', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid body' });
    }
    for (const [key, value] of Object.entries(updates)) {
      run(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, datetime('now','localtime'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
        [key, value == null ? '' : String(value)]
      );
    }
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, bills: query('SELECT COUNT(*) as c FROM bills WHERE is_deleted=0')[0].c });
});

// GET /api/bills
app.get('/api/bills', (req, res) => {
  try {
    const trackerType = (req.query.type === 'wo') ? 'wo' : (req.query.type === 'po') ? 'po' : null;
    const qParams = [req.projectId || 0];
    let typeFilter = '';
    if (trackerType) { typeFilter = 'AND b.tracker_type = ?'; qParams.push(trackerType); }
    const bills = query(`
      SELECT b.*, u.store_handover_date, u.store_recv_date, u.store_remarks, u.dc_number, u.vehicle_number, u.inspection_status, u.shortage_flag, u.storage_location, u.received_by,
        u.ho_received_date, u.qs_received_date, u.doc_ctrl_remarks,
        u.qs_certified_date, u.qs_gross, u.qs_tax, u.qs_total,
        u.advance_recovered, u.credit_note_amt,
        u.retention_money, u.tds_deduction, u.other_deductions,
        u.total_deductions,
        u.certified_net, u.payment_cert, u.qs_remarks,
        u.proc_date, u.proc_verify_date, u.proc_received_date,
        u.mgmt_approval_date, u.proc_remarks, u.accts_jv_date,
        u.accts_dept1, u.accts_dept2, u.transfer_status, u.accts_remarks,
        u.transferred, u.payment_status, u.paid_amount,
        u.balance_to_pay, u.payment_date, u.ai_summary, u.ai_warnings
      FROM bills b
      LEFT JOIN bill_updates u ON b.sl = u.sl
      WHERE b.is_deleted = 0 AND b.project_id = ? ${typeFilter}
      ORDER BY CAST(b.sl AS REAL) ASC
    `, qParams);
    bills.forEach(b => {
      b._hist = query('SELECT dept,action,ts FROM bill_history WHERE sl=? ORDER BY ts DESC LIMIT 20', [b.sl]);
      b._files = query('SELECT id,name,size,type,uploaded_by,uploaded_at FROM bill_files WHERE sl=? ORDER BY uploaded_at ASC', [b.sl]);
      b.transferred = !!b.transferred;
      b.is_new = !!b.is_new;
      // Derive inv_month from inv_date — handle both YYYY-MM-DD and DD-MM-YYYY
      if (b.inv_date && b.inv_date.length >= 7) {
        if (b.inv_date.charAt(4) === '-') {
          b.inv_month = b.inv_date.slice(0, 7); // YYYY-MM-DD → YYYY-MM
        } else if (b.inv_date.charAt(2) === '-') {
          const pts = b.inv_date.split('-');     // DD-MM-YYYY → YYYY-MM
          if (pts.length === 3 && pts[2].length === 4) b.inv_month = pts[2] + '-' + pts[1];
        }
      }
    });
    res.json({ ok: true, bills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/bills
app.post('/api/bills', (req, res) => {
  let txOpen = false;
  try {
    const d = req.body;
    if (!d.vendor) return res.status(400).json({ ok: false, error: 'vendor required' });
    run('BEGIN IMMEDIATE TRANSACTION');
    txOpen = true;

    // Duplicate invoice number check — skip if ?force=1
    if (d.inv_number && d.inv_number.trim() && req.query.force !== '1') {
      const dup = query(
        'SELECT sl FROM bills WHERE LOWER(TRIM(inv_number))=LOWER(TRIM(?)) AND LOWER(TRIM(vendor))=LOWER(TRIM(?)) AND is_deleted=0',
        [d.inv_number, d.vendor]
      );
      if (dup.length) {
        run('ROLLBACK');
        txOpen = false;
        return res.status(409).json({
          ok: false,
          duplicate: true,
          existing_sl: dup[0].sl,
          error: `Duplicate: Invoice "${d.inv_number}" from "${d.vendor}" already exists as SL#${dup[0].sl}`
        });
      }
    }

    const maxRow = query("SELECT MAX(CAST(sl AS INTEGER)) as m FROM bills WHERE TRIM(sl) GLOB '[0-9]*'");
    let nextSl = Math.floor((maxRow[0]?.m || 0)) + 1;
    while (query('SELECT 1 FROM bills WHERE sl=? LIMIT 1', [String(nextSl)]).length) nextSl++;
    const sl = String(nextSl);
    const ttype = d.tracker_type === 'wo' ? 'wo' : 'po';
    run(`INSERT INTO bills (sl,vendor,po_number,po_date,inv_number,inv_date,inv_month,
         received_date,basic_amount,gst_amount,total_amount,credit_note_num,credit_note_val,remarks,tracker_type,project_id,
         transport_charges,transport_gst_pct,transport_gst_amt,other_charges,other_charges_desc,is_new)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [sl,d.vendor,d.po_number||'',d.po_date||'',d.inv_number||'',
       d.inv_date||'',d.inv_month||'',d.received_date||'',
       d.basic_amount||0,d.gst_amount||0,d.total_amount||0,
       d.credit_note_num||'',d.credit_note_val||0,d.remarks||'',ttype,
       req.projectId||0, d.transport_charges||0, d.transport_gst_pct||0, d.transport_gst_amt||0,
       d.other_charges||0, d.other_charges_desc||'']);
    run('INSERT OR IGNORE INTO bill_updates (sl) VALUES (?)', [sl]);
    let inventorySync = { synced: 0, skipped: 0 };
    if (Array.isArray(d.line_items) && d.line_items.length) {
      for (const raw of d.line_items) {
        const qty = parseFloat(raw.quantity) || 0;
        const rate = parseFloat(raw.rate) || 0;
        const basic = parseFloat(raw.basic_amount) || parseFloat((qty * rate).toFixed(2)) || 0;
        const gstPct = parseFloat(raw.gst_pct) || 0;
        const mode = raw.gst_mode === 'interstate' ? 'interstate' : 'intrastate';
        const cgstPct = parseFloat(raw.cgst_pct) || (mode === 'intrastate' ? parseFloat((gstPct / 2).toFixed(2)) : 0);
        const sgstPct = parseFloat(raw.sgst_pct) || (mode === 'intrastate' ? parseFloat((gstPct / 2).toFixed(2)) : 0);
        const igstPct = parseFloat(raw.igst_pct) || (mode === 'interstate' ? gstPct : 0);
        const cgstAmt = parseFloat(raw.cgst_amt) || parseFloat((basic * cgstPct / 100).toFixed(2));
        const sgstAmt = parseFloat(raw.sgst_amt) || parseFloat((basic * sgstPct / 100).toFixed(2));
        const igstAmt = parseFloat(raw.igst_amt) || parseFloat((basic * igstPct / 100).toFixed(2));
        const gstAmt = parseFloat(raw.gst_amount) || parseFloat((cgstAmt + sgstAmt + igstAmt).toFixed(2));
        const totalAmt = parseFloat(raw.total_amount) || parseFloat((basic + gstAmt).toFixed(2));
        run(`INSERT INTO bill_line_items
          (sl,item_code,item_name,category,unit,quantity,rate,basic_amount,gst_pct,gst_mode,
           cgst_pct,cgst_amt,sgst_pct,sgst_amt,igst_pct,igst_amt,gst_amount,total_amount)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [sl, raw.item_code||'', raw.item_name||'', raw.category||'', raw.unit||'',
           qty, rate, basic, gstPct, mode, cgstPct, cgstAmt, sgstPct, sgstAmt, igstPct, igstAmt, gstAmt, totalAmt]);
      }
      inventorySync = applyBillLineItemsToInventory(sl, ttype, d.line_items, {
        txn_date: d.received_date || d.inv_date || new Date().toISOString().slice(0, 10),
        inv_number: d.inv_number || '',
        recorded_by: d.dept || 'system'
      });
    }
    if (d.dept) run('INSERT INTO bill_history (sl,dept,action) VALUES (?,?,?)', [sl,d.dept,'New bill added']);
    run('COMMIT');
    txOpen = false;
    saveDb();
    res.json({ ok: true, sl, inventory_sync: inventorySync });
  } catch (err) {
    if (txOpen) {
      try { run('ROLLBACK'); } catch (_) {}
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/bills/:sl/line-items
app.get('/api/bills/:sl/line-items', (req, res) => {
  try {
    const items = query('SELECT * FROM bill_line_items WHERE sl=? ORDER BY id ASC', [req.params.sl]);
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// POST /api/bills/bulk-update — update same fields across multiple SLs at once
app.post('/api/bills/bulk-update', (req, res) => {
  try {
    const { sls, updates, dept, action } = req.body;
    if (!Array.isArray(sls) || !sls.length) return res.status(400).json({ ok: false, error: 'sls array required' });

    const allowed = [
      'store_handover_date','store_recv_date','ho_received_date','qs_received_date','dc_number','vehicle_number','inspection_status','shortage_flag','storage_location','received_by',
      'qs_certified_date','qs_gross','qs_tax','qs_total','advance_recovered',
      'retention_money','tds_deduction','other_deductions',
      'certified_net','payment_cert','proc_date','proc_received_date',
      'mgmt_approval_date','accts_jv_date','accts_dept1','transfer_status',
      'transferred','payment_status','paid_amount','balance_to_pay','payment_date'
    ];
    const fields = Object.keys(updates || {}).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ ok: false, error: 'No valid fields to update' });

    let updated = 0;
    for (const sl of sls) {
      const exists = query('SELECT sl FROM bills WHERE sl=? AND is_deleted=0', [sl]);
      if (!exists.length) continue;
      run('INSERT OR IGNORE INTO bill_updates (sl) VALUES (?)', [sl]);
      const vals = fields.map(f => updates[f]);
      vals.push(sl);
      run(`UPDATE bill_updates SET ${fields.map(f => f+'=?').join(',')} WHERE sl=?`, vals);
      run(`UPDATE bills SET updated_at=datetime('now','localtime') WHERE sl=?`, [sl]);
      if (dept) run('INSERT INTO bill_history (sl,dept,action) VALUES (?,?,?)', [sl, dept, action||'Bulk updated']);
      updated++;
    }
    saveDb();
    res.json({ ok: true, updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/bills/bulk
app.post('/api/bills/bulk', (req, res) => {
  if (req.dept !== 'admin' && req.dept !== 'doc_ctrl') return res.status(403).json({ ok: false, error: 'Admin or Doc Control only' });
  try {
    const { bills, dept } = req.body;
    if (!Array.isArray(bills)) return res.status(400).json({ ok: false, error: 'bills array required' });
    const maxRow = query('SELECT MAX(CAST(sl AS REAL)) as m FROM bills');
    let nextSL = Math.floor((maxRow[0].m || 0)) + 1;
    let count = 0;
    for (const d of bills) {
      const sl = String(nextSL++);
      const ttype = d.tracker_type === 'wo' ? 'wo' : 'po';
      // Core bill
      run(`INSERT OR IGNORE INTO bills (sl,vendor,po_number,po_date,inv_number,inv_date,
           inv_month,received_date,basic_amount,gst_amount,total_amount,
           credit_note_num,credit_note_val,remarks,tracker_type,project_id,is_new)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [sl, d.vendor||'', d.po_number||'', d.po_date||'', d.inv_number||'',
         d.inv_date||'', d.inv_month||'', d.received_date||'',
         parseFloat(d.basic_amount)||0, parseFloat(d.gst_amount)||0,
         parseFloat(d.total_amount)||0, d.credit_note_num||'',
         parseFloat(d.credit_note_val)||0, d.remarks||'', ttype, req.projectId||0]);
      // All dept update columns
      run(`INSERT OR IGNORE INTO bill_updates
           (sl,store_handover_date,store_recv_date,store_remarks,
            ho_received_date,qs_received_date,doc_ctrl_remarks,
            qs_certified_date,qs_gross,qs_tax,qs_total,
            advance_recovered,credit_note_amt,
            retention_money,tds_deduction,other_deductions,
            total_deductions,
            certified_net,payment_cert,qs_remarks,
            proc_date,proc_verify_date,proc_received_date,
            mgmt_approval_date,proc_remarks,
            accts_jv_date,accts_dept1,transfer_status,
            transferred,accts_remarks,
            payment_status,paid_amount,balance_to_pay,payment_date)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sl,
         d.store_handover_date||'', d.store_recv_date||'', d.store_remarks||'',
         d.ho_received_date||'', d.qs_received_date||'', d.doc_ctrl_remarks||'',
         d.qs_certified_date||'',
         parseFloat(d.qs_gross)||0, parseFloat(d.qs_tax)||0, parseFloat(d.qs_total)||0,
         parseFloat(d.advance_recovered)||0, parseFloat(d.credit_note_amt)||0,
         parseFloat(d.retention_money)||0, parseFloat(d.tds_deduction)||0,
         parseFloat(d.other_deductions)||0,
         parseFloat(d.total_deductions)||0, parseFloat(d.certified_net)||0,
         d.payment_cert||'', d.qs_remarks||'',
         d.proc_date||'', d.proc_verify_date||'', d.proc_received_date||'',
         d.mgmt_approval_date||'', d.proc_remarks||'',
         d.accts_jv_date||'', d.accts_dept1||'', d.transfer_status||'',
         d.transferred ? 1 : 0, d.accts_remarks||'',
         d.payment_status||'', parseFloat(d.paid_amount)||0,
         parseFloat(d.balance_to_pay)||0, d.payment_date||'']);
      if (dept) run('INSERT INTO bill_history (sl,dept,action) VALUES (?,?,?)', [sl, dept, 'Imported']);
      count++;
    }
    saveDb();
    res.json({ ok: true, imported: count });
  } catch (err) {
    console.error('bulk import:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/bills/:sl
app.patch('/api/bills/:sl', (req, res) => {
  let txOpen = false;
  try {
    const { sl } = req.params;
    const { updates, dept, action } = req.body;
    const exists = query('SELECT sl FROM bills WHERE sl=? AND project_id=?', [sl, req.projectId || 0]);
    if (!exists.length) return res.status(404).json({ ok: false, error: 'Not found' });
    run('BEGIN IMMEDIATE TRANSACTION');
    txOpen = true;

    // Build field-level change log
    const currentBill = query('SELECT * FROM bills WHERE sl=?', [sl])[0] || {};
    const currentUpdates = query('SELECT * FROM bill_updates WHERE sl=?', [sl])[0] || {};
    const currentMerged = { ...currentBill, ...currentUpdates };
    const changedFields = [];

    // Core bill fields (bills table) — admin only
    const coreFields = [
      'vendor','po_number','po_date','inv_number','inv_date','inv_month',
      'received_date','basic_amount','gst_amount','total_amount',
      'credit_note_num','credit_note_val','remarks','tracker_type',
      'transport_charges','transport_gst_pct','transport_gst_amt','other_charges','other_charges_desc'
    ];
    const coreToSave = Object.keys(updates || {}).filter(k => coreFields.includes(k));
    if (coreToSave.length > 0) {
      coreToSave.forEach(f => {
        const oldVal = String(currentMerged[f] || '');
        const newVal = String(updates[f] || '');
        if (oldVal !== newVal) changedFields.push(`${f}: "${oldVal}" → "${newVal}"`);
      });
      const vals = coreToSave.map(f => {
        const v = updates[f];
        if (['basic_amount','gst_amount','total_amount','credit_note_val'].includes(f)) return parseFloat(v)||0;
        return v||'';
      });
      vals.push(sl);
      run(`UPDATE bills SET ${coreToSave.map(f => f+'=?').join(',')}, updated_at=datetime('now','localtime') WHERE sl=?`, vals);
    }

    // Dept update fields (bill_updates table)
    run('INSERT OR IGNORE INTO bill_updates (sl) VALUES (?)', [sl]);
    const allowed = [
      'store_handover_date','store_recv_date','store_remarks',
      'ho_received_date','qs_received_date','doc_ctrl_remarks',
      'qs_certified_date','qs_gross','qs_tax','qs_total',
      'advance_recovered','credit_note_amt',
      'retention_money','tds_deduction','other_deductions',
      'total_deductions',
      'certified_net','payment_cert','qs_remarks',
      'proc_date','proc_verify_date','proc_received_date',
      'mgmt_approval_date','proc_remarks','accts_jv_date',
      'accts_dept1','accts_dept2','transfer_status','accts_remarks',
      'transferred','payment_status','paid_amount','balance_to_pay','payment_date'
    ];
    const fields = Object.keys(updates || {}).filter(k => allowed.includes(k));
    if (fields.length > 0) {
      fields.forEach(f => {
        const oldVal = String(currentMerged[f] || '');
        const newVal = String(updates[f] || '');
        if (oldVal !== newVal) changedFields.push(`${f}: "${oldVal}" → "${newVal}"`);
      });
      const vals = fields.map(f => updates[f]);
      vals.push(sl);
      run(`UPDATE bill_updates SET ${fields.map(f => f+'=?').join(',')} WHERE sl=?`, vals);
    }

    if (coreToSave.length === 0) {
      run(`UPDATE bills SET updated_at=datetime('now','localtime') WHERE sl=?`, [sl]);
    }

    // Log with field-level detail when changes detected
    if (dept) {
      const actionText = changedFields.length > 0
        ? `${action||'Updated'} | ${changedFields.slice(0,5).join('; ')}`
        : (action || 'Updated');
      run('INSERT INTO bill_history (sl,dept,action) VALUES (?,?,?)', [sl, dept, actionText]);
    }
    run('COMMIT');
    txOpen = false;
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    if (txOpen) { try { run('ROLLBACK'); } catch (_) {} }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/bills/:sl
app.delete('/api/bills/:sl', (req, res) => {
  try {
    const { sl } = req.params;
    const { dept } = req.body;
    run(`UPDATE bills SET is_deleted=1, updated_at=datetime('now','localtime') WHERE sl=? AND project_id=?`, [sl, req.projectId || 0]);
    if (dept) run('INSERT INTO bill_history (sl,dept,action) VALUES (?,?,?)', [sl,dept||'admin','Deleted']);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/seed
app.post('/api/seed', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const { bills } = req.body;
    if (!Array.isArray(bills)) return res.status(400).json({ ok: false, error: 'bills array required' });
    let count = 0;
    for (const d of bills) {
      const sl = String(d.sl);
      run(`INSERT OR IGNORE INTO bills
           (sl,vendor,po_number,po_date,inv_number,inv_date,inv_month,
            received_date,basic_amount,gst_amount,total_amount,
            credit_note_num,credit_note_val,remarks,is_new)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [sl,d.vendor||'',d.po_number||'',d.po_date||'',
         d.inv_number||'',d.inv_date||'',d.inv_month||'',
         d.received_date||'',d.basic_amount||0,d.gst_amount||0,
         d.total_amount||0,d.credit_note_num||'',d.credit_note_val||0,d.remarks||'']);
      run(`INSERT OR IGNORE INTO bill_updates
           (sl,store_handover_date,ho_received_date,qs_received_date,
            qs_gross,qs_tax,qs_total,advance_recovered,credit_note_amt,
            retention_money,tds_deduction,other_deductions,
            total_deductions,certified_net,payment_cert,accts_jv_date,
            accts_dept1,proc_date,proc_received_date,mgmt_approval_date,
            transfer_status,transferred,payment_status,paid_amount,
            balance_to_pay,payment_date)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sl,d.store_handover_date||'',d.ho_received_date||'',d.qs_received_date||'',
         d.qs_gross||0,d.qs_tax||0,d.qs_total||0,d.advance_recovered||0,
         d.credit_note_amt||0,
         d.retention_money||0,d.tds_deduction||0,d.other_deductions||0,
         d.total_deductions||0,d.certified_net||0,
         d.payment_cert||'',d.accts_jv_date||'',d.accts_dept1||'',
         d.proc_date||'',d.proc_received_date||'',d.mgmt_approval_date||'',
         d.transfer_status||'',d.transferred?1:0,d.payment_status||'',
         d.paid_amount||0,d.balance_to_pay||0,d.payment_date||'']);
      count++;
    }
    saveDb();
    res.json({ ok: true, seeded: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/clear-all — wipe all data (Admin only — no recovery!)
app.post('/api/clear-all', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const { confirm_text } = req.body;
    // Require exact confirmation phrase as a safety check
    if (confirm_text !== 'DELETE ALL DATA') {
      return res.status(400).json({ ok: false, error: 'Confirmation phrase incorrect' });
    }
    run('DELETE FROM bill_history');
    run('DELETE FROM bill_files');
    run('DELETE FROM bill_updates');
    run('DELETE FROM bills');
    // Reset autoincrement
    run(`DELETE FROM sqlite_sequence WHERE name IN ('bill_history')`);
    saveDb();
    console.log('⚠  All data cleared by admin');
    res.json({ ok: true, message: 'All data deleted' });
  } catch (err) {
    console.error('clear-all:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/bills/:sl/files — upload file → saved to disk + metadata in DB
app.post('/api/bills/:sl/files', (req, res) => {
  try {
    const { sl } = req.params;
    const { name, size, type, data, uploaded_by } = req.body;
    if (!name || !data) return res.status(400).json({ ok: false, error: 'name and data required' });

    // Ensure uploads directory exists (safety — in case folder was deleted)
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    // Save file to disk: uploads/bills/SL-{sl}/{filename}
    const safeFilename = sanitizeFilename(name);
    const uploadDir    = getBillUploadDir(sl);
    // Add timestamp prefix to avoid collisions
    const diskFilename = `${Date.now()}_${safeFilename}`;
    const filePath     = path.join(uploadDir, diskFilename);

    const base64 = data.includes(',') ? data.split(',')[1] : data;
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    // Store metadata in DB (no raw base64 data — just the path)
    run(`INSERT INTO bill_files (sl,name,size,type,data,file_path,uploaded_by) VALUES (?,?,?,?,?,?,?)`,
      [sl, name, size||'', type||'', '', filePath, uploaded_by||'']);
    const id = query('SELECT last_insert_rowid() as id')[0].id;
    saveDb();

    console.log(`[Upload] SL#${sl} → ${diskFilename} (${Math.round((size||0)/1024)}KB)`);
    res.json({ ok: true, id, file_path: filePath });
  } catch (err) {
    console.error('file upload:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/bills/:sl/files/:id — download / view file
app.get('/api/bills/:sl/files/:id', (req, res) => {
  try {
    const rows = query('SELECT * FROM bill_files WHERE id=? AND sl=?', [req.params.id, req.params.sl]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'File not found' });
    const f = rows[0];

    // Prefer disk file
    if (f.file_path && fs.existsSync(f.file_path)) {
      const inline = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'].includes(f.type);
      res.setHeader('Content-Type', f.type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${f.name}"`);
      return res.sendFile(f.file_path);
    }

    // Fallback: legacy base64 from DB
    if (f.data) {
      const base64 = f.data.includes(',') ? f.data.split(',')[1] : f.data;
      const buf = Buffer.from(base64, 'base64');
      res.setHeader('Content-Disposition', `attachment; filename="${f.name}"`);
      res.setHeader('Content-Type', f.type || 'application/octet-stream');
      return res.send(buf);
    }

    res.status(404).json({ ok: false, error: 'File data not found' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/bills/:sl/files/:id/view — inline preview (images/PDF)
app.get('/api/bills/:sl/files/:id/view', (req, res) => {
  try {
    const rows = query('SELECT * FROM bill_files WHERE id=? AND sl=?', [req.params.id, req.params.sl]);
    if (!rows.length) return res.status(404).send('Not found');
    const f = rows[0];
    if (f.file_path && fs.existsSync(f.file_path)) {
      res.setHeader('Content-Type', f.type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${f.name}"`);
      return res.sendFile(f.file_path);
    }
    if (f.data) {
      const base64 = f.data.includes(',') ? f.data.split(',')[1] : f.data;
      res.setHeader('Content-Type', f.type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${f.name}"`);
      return res.send(Buffer.from(base64, 'base64'));
    }
    res.status(404).send('Not found');
  } catch (err) { res.status(500).send(err.message); }
});

// DELETE /api/bills/:sl/files/:id — delete file from disk + DB
app.delete('/api/bills/:sl/files/:id', (req, res) => {
  try {
    const rows = query('SELECT * FROM bill_files WHERE id=? AND sl=?', [req.params.id, req.params.sl]);
    if (rows.length && rows[0].file_path) {
      try { fs.unlinkSync(rows[0].file_path); } catch(e) {} // remove from disk
    }
    run('DELETE FROM bill_files WHERE id=? AND sl=?', [req.params.id, req.params.sl]);
    saveDb();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/uploads/browse — list all uploaded files organised by SL (Admin use)
app.get('/api/uploads/browse', (req, res) => {
  try {
    const result = [];
    if (fs.existsSync(UPLOADS_DIR)) {
      const slDirs = fs.readdirSync(UPLOADS_DIR).filter(d => d.startsWith('SL-'));
      slDirs.forEach(slDir => {
        const fullDir = path.join(UPLOADS_DIR, slDir);
        const files   = fs.readdirSync(fullDir).map(f => {
          const stat = fs.statSync(path.join(fullDir, f));
          return { name: f, size: stat.size, mtime: stat.mtime.toISOString() };
        });
        result.push({ sl: slDir.replace('SL-',''), folder: fullDir, files });
      });
    }
    res.json({ ok: true, uploads_dir: UPLOADS_DIR, bills: result });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/send-email — Gmail
app.post('/api/send-email', async (req, res) => {
  try {
    const { provider, from, pass, to, subject, htmlBody, tenantId, clientId, clientSecret } = req.body || {};
    const selectedProvider = (provider || 'gmail').toLowerCase();
    const finalSubject = subject || 'TQS Bill Tracker - Management Report';
    if (!to) return res.status(400).json({ ok: false, error: 'Missing recipient list (to).' });

    if (selectedProvider === 'm365') {
      if (!tenantId || !clientId || !clientSecret || !from) {
        return res.status(400).json({ ok: false, error: 'Missing tenantId/clientId/clientSecret/from for M365.' });
      }

      const recipients = String(to).split(',').map(v => v.trim()).filter(Boolean).map(address => ({ emailAddress: { address } }));
      if (!recipients.length) return res.status(400).json({ ok: false, error: 'No valid recipient emails.' });

      const httpRequest = (url, options = {}, rawBody = '') => new Promise((resolve, reject) => {
        const u = new URL(url);
        const reqOpts = {
          method: options.method || 'POST',
          hostname: u.hostname,
          path: u.pathname + (u.search || ''),
          headers: options.headers || {}
        };
        const req2 = https.request(reqOpts, (resp) => {
          let data = '';
          resp.on('data', chunk => { data += chunk; });
          resp.on('end', () => resolve({ status: resp.statusCode || 500, body: data }));
        });
        req2.on('error', reject);
        if (rawBody) req2.write(rawBody);
        req2.end();
      });

      const tokenBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default'
      }).toString();

      const tokenResp = await httpRequest(
        `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(tokenBody)
          }
        },
        tokenBody
      );
      if (tokenResp.status < 200 || tokenResp.status >= 300) {
        return res.status(500).json({ ok: false, error: `M365 token failed (${tokenResp.status}): ${tokenResp.body}` });
      }

      const tokenJson = JSON.parse(tokenResp.body || '{}');
      const accessToken = tokenJson.access_token;
      if (!accessToken) return res.status(500).json({ ok: false, error: 'M365 token response missing access_token.' });

      const graphPayload = JSON.stringify({
        message: {
          subject: finalSubject,
          body: { contentType: 'HTML', content: htmlBody || '' },
          toRecipients: recipients
        },
        saveToSentItems: true
      });

      const sendResp = await httpRequest(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(graphPayload)
          }
        },
        graphPayload
      );
      if (sendResp.status < 200 || sendResp.status >= 300) {
        return res.status(500).json({ ok: false, error: `M365 send failed (${sendResp.status}): ${sendResp.body}` });
      }
    } else {
      if (!from || !pass) return res.status(400).json({ ok: false, error: 'Missing from/pass for Gmail.' });

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: from, pass: pass },
        tls: { rejectUnauthorized: false }
      });

    await transporter.sendMail({
      from: `"TQS Bill Tracker" <${from}>`,
      to: to,
      subject: finalSubject,
      html: htmlBody
    });

    }
    console.log(`Email report sent via ${selectedProvider} to:`, to);
    res.json({ ok: true });
  } catch (err) {
    console.error('Email error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── BACKUP ENDPOINTS ──

// GET /api/backup — full JSON export of all tables
// POST /api/test-m365 - validate Microsoft 365 Graph connection
app.post('/api/test-m365', async (req, res) => {
  try {
    const { tenantId, clientId, clientSecret, from } = req.body || {};
    if (!tenantId || !clientId || !clientSecret || !from) {
      return res.status(400).json({ ok: false, error: 'Missing tenantId/clientId/clientSecret/from.' });
    }

    const httpRequest = (url, options = {}, rawBody = '') => new Promise((resolve, reject) => {
      const u = new URL(url);
      const reqOpts = {
        method: options.method || 'POST',
        hostname: u.hostname,
        path: u.pathname + (u.search || ''),
        headers: options.headers || {}
      };
      const req2 = https.request(reqOpts, (resp) => {
        let data = '';
        resp.on('data', chunk => { data += chunk; });
        resp.on('end', () => resolve({ status: resp.statusCode || 500, body: data }));
      });
      req2.on('error', reject);
      if (rawBody) req2.write(rawBody);
      req2.end();
    });

    const tokenBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default'
    }).toString();

    const tokenResp = await httpRequest(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(tokenBody)
        }
      },
      tokenBody
    );
    if (tokenResp.status < 200 || tokenResp.status >= 300) {
      return res.status(500).json({ ok: false, error: `M365 token failed (${tokenResp.status}): ${tokenResp.body}` });
    }

    const tokenJson = JSON.parse(tokenResp.body || '{}');
    const accessToken = tokenJson.access_token;
    if (!accessToken) return res.status(500).json({ ok: false, error: 'M365 token response missing access_token.' });

    const userResp = await httpRequest(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}?$select=id,displayName,mail,userPrincipalName`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (userResp.status < 200 || userResp.status >= 300) {
      return res.status(500).json({ ok: false, error: `M365 mailbox check failed (${userResp.status}): ${userResp.body}` });
    }

    const u = JSON.parse(userResp.body || '{}');
    res.json({
      ok: true,
      message: 'M365 connection successful.',
      mailbox: u.mail || u.userPrincipalName || from,
      displayName: u.displayName || ''
    });
  } catch (err) {
    console.error('M365 test error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/backup', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const bills    = query('SELECT * FROM bills ORDER BY sl');
    const updates  = query('SELECT * FROM bill_updates ORDER BY sl');
    const history  = query('SELECT * FROM bill_history ORDER BY id');
    const vendors  = query('SELECT * FROM vendors ORDER BY id');
    const settings = query('SELECT * FROM app_settings');
    const files    = query('SELECT id,sl,name,size,type,uploaded_by,uploaded_at FROM bill_files ORDER BY id');

    const backup = {
      version: 3,
      app: 'TQS Bill Tracker',
      created_at: new Date().toISOString(),
      stats: { bills: bills.length, vendors: vendors.length, updates: updates.length, history: history.length, files: files.length },
      data: { bills, bill_updates: updates, bill_history: history, vendors, app_settings: settings, bill_files_meta: files }
    };

    const filename = `TQS_Backup_${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (err) {
    console.error('Backup error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/backup/full — full backup including file data (larger)
app.get('/api/backup/full', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const bills    = query('SELECT * FROM bills ORDER BY sl');
    const updates  = query('SELECT * FROM bill_updates ORDER BY sl');
    const history  = query('SELECT * FROM bill_history ORDER BY id');
    const vendors  = query('SELECT * FROM vendors ORDER BY id');
    const settings = query('SELECT * FROM app_settings');
    const files    = query('SELECT * FROM bill_files ORDER BY id');

    const backup = {
      version: 3,
      app: 'TQS Bill Tracker',
      full: true,
      created_at: new Date().toISOString(),
      stats: { bills: bills.length, vendors: vendors.length, updates: updates.length, history: history.length, files: files.length },
      data: { bills, bill_updates: updates, bill_history: history, vendors, app_settings: settings, bill_files: files }
    };

    const filename = `TQS_FullBackup_${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/restore — restore from JSON backup
app.post('/api/restore', (req, res) => {
  if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Admin only' });
  try {
    const { backup, mode } = req.body; // mode: 'merge' | 'replace'
    if (!backup || !backup.data) return res.status(400).json({ ok: false, error: 'Invalid backup file' });

    const d = backup.data;
    let restored = { bills: 0, vendors: 0, updates: 0, history: 0, files: 0 };

    if (mode === 'replace') {
      // Wipe and replace everything
      run('DELETE FROM bill_files');
      run('DELETE FROM bill_history');
      run('DELETE FROM bill_updates');
      run('DELETE FROM bills');
      run('DELETE FROM vendors');
    }

    // Restore vendors
    if (d.vendors && d.vendors.length) {
      for (const v of d.vendors) {
        try {
          run(`INSERT OR IGNORE INTO vendors 
            (id,name,trade_name,contact_person,phone,email,address,city,state,pincode,
             gstin,pan,trade_license,msme_reg,vendor_type,bank_name,bank_account,
             bank_ifsc,bank_branch,notes,is_active,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [v.id,v.name||'',v.trade_name||'',v.contact_person||'',v.phone||'',v.email||'',
             v.address||'',v.city||'',v.state||'',v.pincode||'',v.gstin||'',v.pan||'',
             v.trade_license||'',v.msme_reg||'',v.vendor_type||'',v.bank_name||'',
             v.bank_account||'',v.bank_ifsc||'',v.bank_branch||'',v.notes||'',
             v.is_active??1,v.created_at||'',v.updated_at||'']);
          restored.vendors++;
        } catch(e) { /* skip duplicates */ }
      }
    }

    // Restore bills
    if (d.bills && d.bills.length) {
      for (const b of d.bills) {
        try {
          run(`INSERT OR IGNORE INTO bills
            (sl,vendor,po_number,po_date,inv_number,inv_date,inv_month,received_date,
             basic_amount,gst_amount,total_amount,credit_note_num,credit_note_val,
             remarks,tracker_type,is_deleted,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [b.sl,b.vendor||'',b.po_number||'',b.po_date||'',b.inv_number||'',
             b.inv_date||'',b.inv_month||'',b.received_date||'',
             parseFloat(b.basic_amount)||0,parseFloat(b.gst_amount)||0,
             parseFloat(b.total_amount)||0,b.credit_note_num||'',
             parseFloat(b.credit_note_val)||0,b.remarks||'',
             b.tracker_type||'po',
             b.is_deleted||0,b.created_at||'',b.updated_at||'']);
          restored.bills++;
        } catch(e) { /* skip duplicates */ }
      }
    }

    // Restore bill_updates
    if (d.bill_updates && d.bill_updates.length) {
      for (const u of d.bill_updates) {
        try {
          const keys = Object.keys(u).filter(k => k !== 'sl');
          if (!keys.length) continue;
          run('INSERT OR IGNORE INTO bill_updates (sl) VALUES (?)', [u.sl]);
          run(`UPDATE bill_updates SET ${keys.map(k=>k+'=?').join(',')} WHERE sl=?`,
            [...keys.map(k=>u[k]), u.sl]);
          restored.updates++;
        } catch(e) { /* skip */ }
      }
    }

    // Restore bill_history
    if (d.bill_history && d.bill_history.length) {
      for (const h of d.bill_history) {
        try {
          run('INSERT OR IGNORE INTO bill_history (id,sl,dept,action,ts) VALUES (?,?,?,?,?)',
            [h.id, h.sl, h.dept||'', h.action||'', h.ts||'']);
          restored.history++;
        } catch(e) { /* skip */ }
      }
    }

    // Restore files (if full backup)
    const fileSource = d.bill_files || [];
    if (fileSource.length) {
      for (const f of fileSource) {
        if (!f.data) continue; // skip metadata-only entries
        try {
          run('INSERT OR IGNORE INTO bill_files (id,sl,name,size,type,data,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?)',
            [f.id, f.sl, f.name||'', f.size||'', f.type||'', f.data, f.uploaded_by||'', f.uploaded_at||'']);
          restored.files++;
        } catch(e) { /* skip */ }
      }
    }

    // Restore app_settings (branding etc.)
    if (d.app_settings && d.app_settings.length) {
      for (const s of d.app_settings) {
        try {
          run(`INSERT INTO app_settings (key, value, updated_at)
               VALUES (?, ?, datetime('now','localtime'))
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
            [s.key, s.value||'']);
        } catch(e) { /* skip */ }
      }
    }

    saveDb();
    console.log('Restore complete:', restored);
    res.json({ ok: true, restored });
  } catch (err) {
    console.error('Restore error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════════════════
// AUTO-BACKUP
// ══════════════════════════════════════════════════════

function runAutoBackup() {
  try {
    const bills    = query('SELECT * FROM bills ORDER BY sl');
    const updates  = query('SELECT * FROM bill_updates ORDER BY sl');
    const history  = query('SELECT * FROM bill_history ORDER BY id');
    const vendors  = query('SELECT * FROM vendors ORDER BY id');
    const settings = query('SELECT * FROM app_settings');
    const files    = query('SELECT id,sl,name,size,type,uploaded_by,uploaded_at FROM bill_files ORDER BY id');

    const now = new Date();
    const backup = {
      version: 3,
      app: 'TQS Bill Tracker',
      created_at: now.toISOString(),
      auto: true,
      stats: { bills: bills.length, vendors: vendors.length, updates: updates.length, history: history.length },
      data: { bills, bill_updates: updates, bill_history: history, vendors, app_settings: settings, bill_files_meta: files }
    };

    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 16).replace(':', '');
    const filename = `TQS_AutoBackup_${dateStr}_${timeStr}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup));

    // Save last backup timestamp to settings
    run(`INSERT INTO app_settings (key, value, updated_at) VALUES ('last_autobackup_at', ?, datetime('now','localtime'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [now.toISOString()]);
    run(`INSERT INTO app_settings (key, value, updated_at) VALUES ('last_autobackup_file', ?, datetime('now','localtime'))
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [filename]);
    saveDb();

    // Keep only last 7 backups
    const allBackups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('TQS_AutoBackup_') && f.endsWith('.json'))
      .sort();
    if (allBackups.length > 7) {
      allBackups.slice(0, allBackups.length - 7).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch(e) {}
      });
    }

    console.log(`[AutoBackup] ✓ Saved: ${filename}  (${bills.length} bills, ${vendors.length} vendors)`);
    return { ok: true, filename, stats: backup.stats };
  } catch (err) {
    console.error('[AutoBackup] Error:', err.message);
    return { ok: false, error: err.message };
  }
}

// GET /api/autobackup/status — list saved auto-backups
app.get('/api/autobackup/status', (req, res) => {
  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('TQS_AutoBackup_') && f.endsWith('.json'))
      .sort().reverse().slice(0, 7)
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stat.size, mtime: stat.mtime.toISOString() };
      });
    const lastRow = query("SELECT value FROM app_settings WHERE key='last_autobackup_at'");
    res.json({ ok: true, backups, last_at: lastRow[0]?.value || null });
  } catch (err) {
    res.json({ ok: true, backups: [], last_at: null });
  }
});

// POST /api/autobackup/now — trigger manual backup immediately
app.post('/api/autobackup/now', (req, res) => {
  res.json(runAutoBackup());
});

// GET /api/autobackup/download/:filename — download a saved auto-backup
app.get('/api/autobackup/download/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // prevent path traversal
    if (!filename.startsWith('TQS_AutoBackup_') || !filename.endsWith('.json')) {
      return res.status(400).json({ ok: false, error: 'Invalid filename' });
    }
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ ok: false, error: 'File not found' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filepath);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── BuildPro Procurement Sync Endpoint ──────────────────────────────────────
// POST /api/sync/procurement — receives invoice data from BuildPro, creates/updates a bill
// Auth: x-sync-key header (no user session required)
const BUILDPRO_SYNC_KEY = 'buildpro-tqs-sync-2024';
app.post('/api/sync/procurement', (req, res) => {
  if (req.headers['x-sync-key'] !== BUILDPRO_SYNC_KEY) {
    return res.status(401).json({ ok: false, error: 'Invalid sync key' });
  }
  try {
    const d = req.body;
    if (!d.id) return res.status(400).json({ ok: false, error: 'BuildPro invoice id required' });

    // If already synced, update status, amounts, and any full-bill fields provided
    const existing = query('SELECT sl FROM bills WHERE buildpro_ref=? AND is_deleted=0', [d.id]);
    if (existing.length) {
      const sl = existing[0].sl;
      const updRemarks = d.remarks ||
        `[BuildPro ${d.status||'Pending'}] ${d.material||''}${d.notes ? ' | '+d.notes : ''}`.trim();
      run(`UPDATE bills SET
            vendor=COALESCE(NULLIF(?,''),(SELECT vendor FROM bills WHERE sl=?)),
            po_number=COALESCE(NULLIF(?,''),(SELECT po_number FROM bills WHERE sl=?)),
            inv_number=COALESCE(NULLIF(?,''),(SELECT inv_number FROM bills WHERE sl=?)),
            basic_amount=CASE WHEN ?>0 THEN ? ELSE (SELECT basic_amount FROM bills WHERE sl=?) END,
            total_amount=CASE WHEN ?>0 THEN ? ELSE (SELECT total_amount FROM bills WHERE sl=?) END,
            cgst_pct=CASE WHEN ?>0 THEN ? ELSE (SELECT cgst_pct FROM bills WHERE sl=?) END,
            cgst_amt=CASE WHEN ?>0 THEN ? ELSE (SELECT cgst_amt FROM bills WHERE sl=?) END,
            sgst_pct=CASE WHEN ?>0 THEN ? ELSE (SELECT sgst_pct FROM bills WHERE sl=?) END,
            sgst_amt=CASE WHEN ?>0 THEN ? ELSE (SELECT sgst_amt FROM bills WHERE sl=?) END,
            igst_pct=CASE WHEN ?>0 THEN ? ELSE (SELECT igst_pct FROM bills WHERE sl=?) END,
            igst_amt=CASE WHEN ?>0 THEN ? ELSE (SELECT igst_amt FROM bills WHERE sl=?) END,
            remarks=?, updated_at=datetime('now','localtime')
           WHERE sl=?`,
        [d.vendorName||'', sl, d.poNumber||d.poId||'', sl, d.invNumber||d.id, sl,
         Number(d.basicAmount||d.amount)||0, Number(d.basicAmount||d.amount)||0, sl,
         Number(d.totalAmount||d.amount)||0, Number(d.totalAmount||d.amount)||0, sl,
         Number(d.cgstPct)||0, Number(d.cgstPct)||0, sl,
         Number(d.cgstAmt)||0, Number(d.cgstAmt)||0, sl,
         Number(d.sgstPct)||0, Number(d.sgstPct)||0, sl,
         Number(d.sgstAmt)||0, Number(d.sgstAmt)||0, sl,
         Number(d.igstPct)||0, Number(d.igstPct)||0, sl,
         Number(d.igstAmt)||0, Number(d.igstAmt)||0, sl,
         updRemarks, sl]);
      saveDb();
      console.log(`[BuildPro Sync] Updated bill SL#${sl} for invoice ${d.id}`);
      return res.json({ ok: true, action: 'updated', sl });
    }

    // Create new bill from BuildPro invoice
    const maxRow = query("SELECT MAX(CAST(sl AS INTEGER)) as m FROM bills WHERE TRIM(sl) GLOB '[0-9]*'");
    let nextSl = Math.floor((maxRow[0]?.m || 0)) + 1;
    while (query('SELECT 1 FROM bills WHERE sl=? LIMIT 1', [String(nextSl)]).length) nextSl++;
    const sl = String(nextSl);

    // Resolve the project_id
    let projectId = 0;
    if (d.projectName) {
      const match = query("SELECT id FROM projects WHERE name LIKE ? OR code LIKE ? LIMIT 1", [`%${d.projectName}%`, `%${d.projectName}%`]);
      if (match.length) projectId = match[0].id;
    }
    // Default to TQS-Bengaluru (ID 2) if no match, or the first active project if ID 2 doesn't exist
    if (projectId === 0) {
      const tqsBlr = query("SELECT id FROM projects WHERE code='TQS-BLR' LIMIT 1");
      if (tqsBlr.length) {
        projectId = tqsBlr[0].id;
      } else {
        const activeProj = query("SELECT id FROM projects WHERE is_active=1 ORDER BY id ASC LIMIT 1");
        projectId = activeProj.length ? activeProj[0].id : 0;
      }
    }

    // Resolve dates — full-bill entry provides specific fields; fallback to created_at
    const fallbackDate = d.created_at ? d.created_at.slice(0, 10) : '';
    const invDate      = d.invDate      || fallbackDate;
    const invMonth     = d.invMonth     || (invDate.length >= 7 ? invDate.slice(0, 7) : '');
    const receivedDate = d.receivedDate || fallbackDate;
    const poNumber     = d.poNumber     || d.poId || '';
    const poDate       = d.poDate       || '';
    const invNumber    = d.invNumber    || d.id;
    const basic        = Number(d.basicAmount || d.amount) || 0;
    const totalAmt     = Number(d.totalAmount || d.amount) || 0;
    const gstAmt       = Number(d.gstAmount)  || 0;
    const trackerType  = (d.trackerType === 'wo') ? 'wo' : 'po';
    const remarks      = d.remarks ||
      `[BuildPro ${d.status||'Pending'}] ${d.material||''}${d.notes ? ' | '+d.notes : ''}`.trim();

    run(`INSERT INTO bills
         (sl, vendor, po_number, po_date, inv_number, inv_date, inv_month, received_date,
          basic_amount, gst_amount, total_amount,
          cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt,
          transport_charges, transport_gst_pct, transport_gst_amt,
          other_charges, other_charges_desc,
          credit_note_num, credit_note_val,
          remarks, tracker_type, buildpro_ref, project_id, is_new)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [sl,
       d.vendorName || 'Unknown',
       poNumber, poDate,
       invNumber, invDate, invMonth, receivedDate,
       basic, gstAmt, totalAmt,
       Number(d.cgstPct)||0, Number(d.cgstAmt)||0,
       Number(d.sgstPct)||0, Number(d.sgstAmt)||0,
       Number(d.igstPct)||0, Number(d.igstAmt)||0,
       Number(d.transportCharges)||0, Number(d.transportGstPct)||0, Number(d.transportGstAmt)||0,
       Number(d.otherCharges)||0, d.otherChargesDesc||'',
       d.creditNoteNum||'', Number(d.creditNoteVal)||0,
       remarks, trackerType, d.id, projectId]);
    run('INSERT OR IGNORE INTO bill_updates (sl) VALUES (?)', [sl]);
    saveDb();
    console.log(`[BuildPro Sync] Created bill SL#${sl} from invoice ${d.id} (project_id=${projectId})`);
    res.json({ ok: true, action: 'created', sl });
  } catch (err) {
    console.error('[BuildPro Sync] Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/sync/procurement-grn', (req, res) => {
  if (req.headers['x-sync-key'] !== BUILDPRO_SYNC_KEY) {
    return res.status(401).json({ ok: false, error: 'Invalid sync key' });
  }
  try {
    const d = req.body;
    if (!d.id) return res.status(400).json({ ok: false, error: 'GRN id required' });
    
    const material = String(d.material || '').trim();
    if (!material) return res.status(400).json({ ok: false, error: 'Material name is required for inventory' });

    const qty = Number(d.receivedQty) || 0;
    if (qty <= 0) return res.status(400).json({ ok: false, error: 'Invalid received quantity' });

    let rate = 0;
    if (d.poTotal && d.poQty) {
      rate = d.poTotal / d.poQty;
    }

    const itemCode = material;
    const txnDate = new Date().toISOString().slice(0, 10);

    const exists = query('SELECT * FROM stock_items WHERE item_code=?', [itemCode]);
    let currentQty = 0;
    let currentValue = 0;
    if (!exists.length) {
      run(`INSERT INTO stock_items (item_code,item_name,category,unit,gst_pct,last_rate,current_qty,current_value)
           VALUES (?,?,?,?,?,?,?,?)`,
        [itemCode, material, 'Procured', d.unit || 'Nos', 0, rate, 0, 0]);
    } else {
      currentQty = Number(exists[0].current_qty) || 0;
      currentValue = Number(exists[0].current_value) || 0;
    }

    const valueIn = qty * rate;
    const newQty = currentQty + qty;
    const newVal = currentValue + valueIn;
    const newRate = newQty > 0 ? newVal / newQty : rate;

    // Use GRN id for ref_id and bill_sl to help trace if needed
    run(`INSERT INTO stock_ledger (item_code,txn_date,txn_type,ref_type,ref_id,bill_sl,qty_in,rate,value_in,balance_qty,balance_value,narration,recorded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [itemCode, txnDate, 'Receipt', 'GRN', d.id, d.id, qty, rate, valueIn, newQty, newVal, `Auto receipt from BuildPro GRN ${d.id}`, 'system']);

    run(`UPDATE stock_items SET current_qty=?, current_value=?, last_rate=?, updated_at=datetime('now','localtime') WHERE item_code=?`,
      [newQty, newVal, newRate, itemCode]);
    saveDb();

    console.log(`[BuildPro Sync] Inventory updated for GRN ${d.id}`);
    res.json({ ok: true, action: 'inventory_updated' });
  } catch (err) {
    console.error('[BuildPro Sync] Inventory Error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── CONSTRUCTERP INTEGRATION ────────────────────────────────────────────────
// Pull vendors from ConstructERP India Pro and import them into TQS.
// Call POST /api/sync/pull-vendors with { erp_url, company_id, sync_key }
app.post('/api/sync/pull-vendors', requireAuth, async (req, res) => {
  const { erp_url = 'http://localhost:5000', company_id, sync_key } = req.body;
  if (!company_id || !sync_key) return res.status(400).json({ ok: false, error: 'company_id and sync_key required' });
  try {
    const response = await new Promise((resolve, reject) => {
      const url = new URL(`/api/v1/sync/vendors?company_id=${company_id}`, erp_url);
      const lib = url.protocol === 'https:' ? https : require('http');
      const request = lib.get(url.toString(), { headers: { 'x-sync-key': sync_key } }, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
        });
      });
      request.on('error', reject);
      request.setTimeout(8000, () => { request.destroy(); reject(new Error('Timeout')); });
    });

    if (!response.ok) return res.status(502).json({ ok: false, error: response.error });

    let created = 0, skipped = 0;
    (response.data || []).forEach(v => {
      const existing = query('SELECT id FROM vendors WHERE name=?', [v.name]);
      if (existing.length) { skipped++; return; }
      run(`INSERT INTO vendors (name, trade_name, contact_person, phone, email, address, city, state, gstin, pan, vendor_type, is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
        [v.name, v.name, v.contact_person||'', v.phone||'', v.email||'', v.address||'', v.city||'', v.state||'', v.gstin||'', v.pan||'', v.vendor_type||'material']);
      created++;
    });
    saveDb();
    res.json({ ok: true, created, skipped, total: (response.data || []).length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
      }
    }
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║     TQS Bill Tracker — Server Running            ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}                  ║`);
    console.log(`║  Network: http://${localIP}:${PORT}              ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Share the Network URL with all office users     ║');
    console.log('║  Database saved to: tqs_erp.db               ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    // ── Start auto-backup scheduler (every 24 hours) ──
    const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    setInterval(runAutoBackup, BACKUP_INTERVAL_MS);
    console.log('[AutoBackup] Scheduled: daily backup every 24 hours');
    console.log('[AutoBackup] Backups folder:', BACKUP_DIR);

    // Run an initial backup on first start if none exists today
    const today = new Date().toISOString().slice(0, 10);
    const todayBackup = fs.readdirSync(BACKUP_DIR).find(f => f.includes(today));
    if (!todayBackup) {
      setTimeout(runAutoBackup, 5000); // 5s delay to let server fully init
    }
  });
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

// ══════════════════════════════════════════════════════
// PO LIFECYCLE ENDPOINTS
// ══════════════════════════════════════════════════════

// GET /api/po — list all POs with live computed financials
app.get('/api/po', (req, res) => {
  try {
    const type = req.query.type || null;
    const poParams = [req.projectId || 0];
    let poTypeFilter = '';
    if (type === 'po' || type === 'wo') { poTypeFilter = 'AND p.tracker_type = ?'; poParams.push(type); }
    const pos = query(`
      SELECT p.*,
        COALESCE(SUM(b.total_amount),0) AS billed_to_date,
        COALESCE(SUM(u.certified_net),0) AS certified_to_date,
        COUNT(b.sl) AS invoice_count,
        p.po_value - COALESCE(SUM(b.total_amount),0) AS balance_uncommitted,
        ROUND(CASE WHEN p.po_value>0 THEN COALESCE(SUM(b.total_amount),0)/p.po_value*100 ELSE 0 END,1) AS utilisation_pct
      FROM purchase_orders p
      LEFT JOIN bills b ON b.po_number = p.po_number AND b.is_deleted=0
      LEFT JOIN bill_updates u ON u.sl = b.sl
      WHERE p.project_id = ? ${poTypeFilter}
      GROUP BY p.po_number
      ORDER BY p.created_at DESC
    `, poParams);
    res.json({ ok: true, pos });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/po/:po_number — single PO detail with amendments, invoices, GRNs
app.get('/api/po/:po_number', (req, res) => {
  try {
    const pn = req.params.po_number;
    const rows = query('SELECT * FROM purchase_orders WHERE po_number=?', [pn]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'PO not found' });
    const po = rows[0];
    po.amendments = query('SELECT * FROM po_amendments WHERE po_number=? ORDER BY amendment_no', [pn]);
    po.invoices   = query(`SELECT b.sl, b.inv_number, b.inv_date, b.total_amount, u.certified_net, u.payment_status, b.tracker_type
                            FROM bills b LEFT JOIN bill_updates u ON u.sl=b.sl
                            WHERE b.po_number=? AND b.is_deleted=0`, [pn]);
    po.grns       = query('SELECT * FROM grn_entries WHERE po_number=? ORDER BY grn_date DESC', [pn]);
    // live match summary
    const totalInv  = po.invoices.reduce((s,r)=>s+(parseFloat(r.total_amount)||0),0);
    const totalGRN  = po.grns.reduce((s,r)=>s+(parseFloat(r.grn_value)||0),0);
    const totalCert = po.invoices.reduce((s,r)=>s+(parseFloat(r.certified_net)||0),0);
    po.match = {
      po_value: po.po_value,
      billed_to_date: totalInv,
      grn_to_date: totalGRN,
      certified_to_date: totalCert,
      balance: po.po_value - totalInv,
      inv_vs_po_pct: po.po_value>0 ? +((totalInv/po.po_value)*100).toFixed(1) : 0,
      inv_vs_grn_pct: totalGRN>0   ? +((totalInv/totalGRN)*100).toFixed(1)   : 0,
    };
    res.json({ ok: true, po });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/po — create new PO
app.post('/api/po', (req, res) => {
  try {
    const d = req.body;
    if (!d.po_number || !d.vendor) return res.status(400).json({ ok: false, error: 'po_number and vendor required' });
    const exists = query('SELECT po_number FROM purchase_orders WHERE po_number=?', [d.po_number]);
    if (exists.length) return res.status(409).json({ ok: false, error: 'PO number already exists' });
    run(`INSERT INTO purchase_orders (po_number,vendor,po_date,po_value,description,site_code,tracker_type,status,approved_by,approval_date,project_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [d.po_number, d.vendor, d.po_date||'', parseFloat(d.po_value)||0,
       d.description||'', d.site_code||'', d.tracker_type==='wo'?'wo':'po',
       d.status||'Active', d.approved_by||'', d.approval_date||'',
       req.projectId||0]);
    saveDb();
    res.json({ ok: true, po_number: d.po_number });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/po/:po_number — update PO status / fields
app.patch('/api/po/:po_number', (req, res) => {
  try {
    const pn = req.params.po_number;
    const d  = req.body;
    const allowed = ['status','approved_by','approval_date','description','site_code','po_date'];
    const fields  = Object.keys(d).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ ok: false, error: 'No valid fields' });
    run(`UPDATE purchase_orders SET ${fields.map(f=>f+'=?').join(',')}, updated_at=datetime('now','localtime') WHERE po_number=?`,
      [...fields.map(f=>d[f]), pn]);
    saveDb();
    res.json({ ok: true });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/po/:po_number — delete PO if no linked downstream records
app.delete('/api/po/:po_number', (req, res) => {
  try {
    if (req.dept !== 'admin' && req.dept !== 'procurement') {
      return res.status(403).json({ ok: false, error: 'Only Admin/Procurement can delete POs' });
    }
    const pn = String(req.params.po_number || '').trim();
    if (!pn) return res.status(400).json({ ok: false, error: 'PO number required' });

    const po = query('SELECT po_number FROM purchase_orders WHERE po_number=? AND project_id=?', [pn, req.projectId || 0]);
    if (!po.length) return res.status(404).json({ ok: false, error: 'PO not found' });

    const linkedInvoices = query('SELECT COUNT(*) AS c FROM bills WHERE po_number=? AND is_deleted=0', [pn])[0].c || 0;
    const linkedGrn      = query('SELECT COUNT(*) AS c FROM grn_entries WHERE po_number=?', [pn])[0].c || 0;
    const linkedAmend    = query('SELECT COUNT(*) AS c FROM po_amendments WHERE po_number=?', [pn])[0].c || 0;
    if (linkedInvoices > 0 || linkedGrn > 0 || linkedAmend > 0) {
      return res.status(409).json({
        ok: false,
        error: `Cannot delete PO. Linked records exist (invoices: ${linkedInvoices}, grn: ${linkedGrn}, amendments: ${linkedAmend}).`
      });
    }

    run('BEGIN IMMEDIATE TRANSACTION');
    try {
      run('DELETE FROM po_items WHERE po_number=?', [pn]);
      run('DELETE FROM purchase_orders WHERE po_number=? AND project_id=?', [pn, req.projectId || 0]);
      run('COMMIT');
    } catch (txErr) {
      try { run('ROLLBACK'); } catch (_) {}
      throw txErr;
    }
    saveDb();
    res.json({ ok: true, po_number: pn });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/po/:po_number/amend — raise a variation order
app.post('/api/po/:po_number/amend', (req, res) => {
  try {
    const pn = req.params.po_number;
    const d  = req.body;
    const rows = query('SELECT * FROM purchase_orders WHERE po_number=?', [pn]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'PO not found' });
    const po = rows[0];
    const amendNo = (po.amendment_count||0) + 1;
    const originalVal = parseFloat(po.po_value)||0;
    const revisedVal  = parseFloat(d.revised_value)||0;
    run(`INSERT INTO po_amendments (po_number,amendment_no,original_value,revised_value,reason,amended_by,amendment_date)
         VALUES (?,?,?,?,?,?,?)`,
      [pn, amendNo, originalVal, revisedVal, d.reason||'', d.amended_by||'', d.amendment_date||new Date().toISOString().slice(0,10)]);
    run(`UPDATE purchase_orders SET po_value=?, amendment_count=?, updated_at=datetime('now','localtime') WHERE po_number=?`,
      [revisedVal, amendNo, pn]);
    saveDb();
    res.json({ ok: true, amendment_no: amendNo, original_value: originalVal, revised_value: revisedVal });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/grn — record a GRN against a PO
app.post('/api/grn', (req, res) => {
  try {
    const d = req.body;
    if (!d.po_number) return res.status(400).json({ ok: false, error: 'po_number required' });
    run(`INSERT INTO grn_entries (po_number,bill_sl,grn_date,grn_value,received_by,remarks)
         VALUES (?,?,?,?,?,?)`,
      [d.po_number, d.bill_sl||'', d.grn_date||new Date().toISOString().slice(0,10),
       parseFloat(d.grn_value)||0, d.received_by||'', d.remarks||'']);
    saveDb();
    res.json({ ok: true });
  } catch(err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/po/:po_number/match — three-way match result
app.get('/api/po/:po_number/match', (req, res) => {
  try {
    const pn  = req.params.po_number;
    const tol = parseFloat(req.query.tol || '2');
    const rows = query('SELECT po_value FROM purchase_orders WHERE po_number=?', [pn]);
    if (!rows.length) return res.json({ ok: true, match: null, reason: 'PO not registered' });
    const poVal  = parseFloat(rows[0].po_value)||0;
    const invs   = query('SELECT total_amount FROM bills WHERE po_number=? AND is_deleted=0', [pn]);
    const grns   = query('SELECT grn_value FROM grn_entries WHERE po_number=?', [pn]);
    const totalInv = invs.reduce((s,r)=>s+(parseFloat(r.total_amount)||0),0);
    const totalGRN = grns.reduce((s,r)=>s+(parseFloat(r.grn_value)||0),0);
    const pct = (a,b) => b===0 ? 0 : Math.abs((a-b)/b*100);
    const grade = (p) => p<=tol?'pass': p<=tol*2.5?'warn':'fail';
    const checks = {
      inv_vs_po:  { diff: totalInv-poVal,    pct: pct(totalInv,poVal),   result: grade(pct(totalInv,poVal)),  label:'Invoice vs PO' },
      inv_vs_grn: { diff: totalInv-totalGRN, pct: pct(totalInv,totalGRN),result: grade(pct(totalInv,totalGRN)),label:'Invoice vs GRN' },
      grn_vs_po:  { diff: totalGRN-poVal,    pct: pct(totalGRN,poVal),   result: grade(pct(totalGRN,poVal)),  label:'GRN vs PO' },
    };
    const results = Object.values(checks).map(c=>c.result);
    const overall = results.includes('fail')?'fail': results.includes('warn')?'warn':'pass';
    res.json({ ok:true, po_value:poVal, billed:totalInv, grn:totalGRN, checks, overall, tolerance:tol });
  } catch(err) { res.status(500).json({ ok:false, error:err.message }); }
});

// ══════════════════════════════════════════════════════
// PO ITEMS ENDPOINTS
// ══════════════════════════════════════════════════════

// POST /api/po/:po_number/items — save/replace all line items for a PO
app.post('/api/po/:po_number/items', (req, res) => {
  try {
    const pn = req.params.po_number;
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok:false, error:'items array required' });
    // Delete existing and re-insert
    run('DELETE FROM po_items WHERE po_number=?', [pn]);
    let totalVal = 0;
    items.forEach((it, idx) => {
      const amt = parseFloat(it.amount) || (parseFloat(it.quantity||0) * parseFloat(it.rate||0));
      totalVal += amt;
      const gp = parseFloat(it.gst_pct)||0;
      const ga = parseFloat(it.gst_amt)||parseFloat((amt*gp/100).toFixed(2));
      const ta = parseFloat(it.total_amt)||(amt+ga);
      run(`INSERT INTO po_items (po_number,sl_no,description,uom,quantity,rate,amount,gst_pct,gst_amt,total_amt,heads)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [pn, idx+1, it.description||'', it.uom||'', parseFloat(it.quantity)||0,
         parseFloat(it.rate)||0, amt, gp, ga, ta, it.heads||'']);
    });
    // Update po_value from items total
    run(`UPDATE purchase_orders SET po_value=?, updated_at=datetime('now','localtime') WHERE po_number=?`,
      [totalVal, pn]);
    saveDb();
    res.json({ ok:true, item_count: items.length, total_value: totalVal });
  } catch(err) { res.status(500).json({ ok:false, error:err.message }); }
});

// GET /api/po/:po_number/items — get line items for a PO
app.get('/api/po/:po_number/items', (req, res) => {
  try {
    const pn = req.params.po_number;
    const items = query('SELECT * FROM po_items WHERE po_number=? ORDER BY sl_no', [pn]);
    res.json({ ok:true, items });
  } catch(err) { res.status(500).json({ ok:false, error:err.message }); }
});

// POST /api/po — updated to also accept items and extra fields
// (extends existing POST /api/po by also saving items if provided)
app.post('/api/po/full', (req, res) => {
  try {
    const d = req.body;
    if (!d.po_number || !d.vendor) return res.status(400).json({ ok:false, error:'po_number and vendor required' });
    const exists = query('SELECT po_number FROM purchase_orders WHERE po_number=?', [d.po_number]);
    if (exists.length) return res.status(409).json({ ok:false, error:'PO number already exists' });

    // Compute total from items
    const items = d.items || [];
    let totalVal = items.reduce((s,it) => {
      const basic = parseFloat(it.amount) || (parseFloat(it.quantity||0)*parseFloat(it.rate||0));
      const gstPct = parseFloat(it.gst_pct)||0;
      const gstAmt = parseFloat(it.gst_amt)||parseFloat((basic*gstPct/100).toFixed(2));
      const tot = parseFloat(it.total_amt)||(basic+gstAmt);
      return s + tot;
    }, 0);
    if (totalVal === 0) totalVal = parseFloat(d.po_value)||0;

    run(`INSERT INTO purchase_orders
         (po_number,vendor,po_date,po_value,description,site_code,tracker_type,status,
          approved_by,approval_date,po_req_no,po_req_date,approval_no,
          delivery_address,delivery_contact,narration,form_no,project_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.po_number, d.vendor, d.po_date||'', totalVal,
       d.description||'', d.site_code||'', d.tracker_type==='wo'?'wo':'po',
       d.status||'Active', d.approved_by||'', d.approval_date||'',
       d.po_req_no||'', d.po_req_date||'', d.approval_no||'',
       d.delivery_address||'', d.delivery_contact||'',
       d.narration||'', d.form_no||'BCIM-PUR-F-03', req.projectId||0]);

    // Save items
    items.forEach((it, idx) => {
      const amt = parseFloat(it.amount) || (parseFloat(it.quantity||0)*parseFloat(it.rate||0));
      const gstPct = parseFloat(it.gst_pct)||0;
      const gstAmt = parseFloat(it.gst_amt)||parseFloat((amt*gstPct/100).toFixed(2));
      const totAmt = parseFloat(it.total_amt)||(amt+gstAmt);
      run(`INSERT INTO po_items (po_number,sl_no,description,uom,quantity,rate,amount,gst_pct,gst_amt,total_amt,heads)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [d.po_number, idx+1, it.description||'', it.uom||'', parseFloat(it.quantity)||0,
         parseFloat(it.rate)||0, amt, gstPct, gstAmt, totAmt, it.heads||'']);
    });

    saveDb();
    res.json({ ok:true, po_number:d.po_number, total_value:totalVal, item_count:items.length });
  } catch(err) { res.status(500).json({ ok:false, error:err.message }); }
});

// GET /api/po/:po_number/print-excel — generate PDF via Microsoft Excel template
app.get('/api/po/:po_number/print-excel', async (req, res) => {
  const pn = String(req.params.po_number || '').trim();
  try {
    if (!pn) return res.status(400).json({ ok:false, error:'PO number required' });
    if (!fs.existsSync(PO_EXCEL_TEMPLATE_PATH)) {
      return res.status(500).json({ ok:false, error:'PO Excel template missing at: ' + PO_EXCEL_TEMPLATE_PATH });
    }
    if (!fs.existsSync(PO_EXCEL_EXPORT_SCRIPT)) {
      return res.status(500).json({ ok:false, error:'Excel export script missing at: ' + PO_EXCEL_EXPORT_SCRIPT });
    }

    const rows = query('SELECT * FROM purchase_orders WHERE po_number=? AND project_id=?', [pn, req.projectId || 0]);
    if (!rows.length) return res.status(404).json({ ok:false, error:'PO not found in current project' });
    const po = rows[0];
    const items = query('SELECT * FROM po_items WHERE po_number=? ORDER BY sl_no', [pn]);
    const vrows = query('SELECT * FROM vendors WHERE LOWER(name)=LOWER(?) LIMIT 1', [po.vendor]);
    const vendor = vrows[0] || {};
    const srows = query('SELECT key,value FROM app_settings');
    const settings = {};
    srows.forEach(r => { settings[r.key] = r.value; });

    const numWords = (n) => {
      n = Math.round(parseFloat(n) || 0);
      const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
        'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const b1000 = (x) => {
        if (x < 20) return ones[x];
        if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' ' + ones[x%10] : '');
        return ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' ' + b1000(x%100) : '');
      };
      if (n === 0) return 'Rupees: Zero Only.';
      let p = [];
      if (n >= 10000000) { p.push(b1000(Math.floor(n/10000000)) + ' Crore'); n %= 10000000; }
      if (n >= 100000) { p.push(b1000(Math.floor(n/100000)) + ' Lakh'); n %= 100000; }
      if (n >= 1000) { p.push(b1000(Math.floor(n/1000)) + ' Thousand'); n %= 1000; }
      if (n > 0) p.push(b1000(n));
      return 'Rupees: ' + p.join(' ') + ' Only.';
    };

    const grandTotal = items.reduce((s, it) => {
      const basic = parseFloat(it.amount) || ((parseFloat(it.quantity || 0)) * (parseFloat(it.rate || 0)));
      const gp = parseFloat(it.gst_pct) || 0;
      const ga = parseFloat(it.gst_amt) || parseFloat((basic * gp / 100).toFixed(2));
      const ta = parseFloat(it.total_amt) || (basic + ga);
      return s + ta;
    }, 0);
    const rupees_text = numWords(grandTotal);
    const terms = [
      'All Bills and DCs should contain the Reference of the Concerned PO.',
      'All materials supplied will be subject to inspections and test when received at our site.',
      'Final Bill shall be cleared after Certification by the Concerned Engg and on actual measurements taken at Site.',
      'If any Goods damaged or rejected must be replaced immediately at the suppliers own expenses.',
      'Payment: 60 Days from the date of supply',
      'Lead Time: Within 2-3 days from the date of order',
      'Contract details of Supplier and transport details to be mentioned in bill.',
      'Bill Requirement: Include order no, HSN/GST details, transporter challan.',
      'Quantity Certification: Quantity may be approximate and measured mutually.',
      'Price Escalation/Cancellation clauses as per PO terms.'
    ];

    const tmpDir = path.join(os.tmpdir(), 'tqs-po-print');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const jsonPath = path.join(tmpDir, `po_${stamp}.json`);
    const outPdf = path.join(tmpDir, `po_${stamp}.pdf`);
    fs.writeFileSync(jsonPath, JSON.stringify({ po, items, vendor, settings, rupees_text, terms }), 'utf8');

    try {
      await new Promise((resolve, reject) => {
        execFile(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PO_EXCEL_EXPORT_SCRIPT, '-JsonPath', jsonPath, '-TemplatePath', PO_EXCEL_TEMPLATE_PATH, '-OutPdf', outPdf, '-TrackerType', po.tracker_type || 'po'],
          { timeout: 180000, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) {
              const msg = (stderr || stdout || err.message || '').toString().trim();
              return reject(new Error(msg || 'Excel export failed'));
            }
            resolve();
          }
        );
      });

      if (!fs.existsSync(outPdf)) throw new Error('Excel did not generate PDF output');
      const buf = fs.readFileSync(outPdf);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="PO_${pn}.pdf"`);
      res.send(buf);
    } finally {
      try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch {}
      try { if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf); } catch {}
    }
  } catch (err) {
    console.error('Excel PO print error:', err.message);
    if (!res.headersSent) res.status(500).json({ ok:false, error: err.message });
  }
});

// GET /api/po/:po_number/print — generate PDF matching BCIM PO reference format
app.get('/api/po/:po_number/print', (req, res) => {
  const pn = req.params.po_number;
  try {
    const PDFDocument = require('pdfkit');
    const rows = query('SELECT * FROM purchase_orders WHERE po_number=? AND project_id=?', [pn, req.projectId || 0]);
    if (!rows.length) return res.status(404).json({ ok:false, error:'PO not found' });
    const po    = rows[0];
    const items = query('SELECT * FROM po_items WHERE po_number=? ORDER BY sl_no', [pn]);
    const vrows = query('SELECT * FROM vendors WHERE LOWER(name)=LOWER(?) LIMIT 1', [po.vendor]);
    const v     = vrows[0] || {};
    const settRows = query('SELECT key,value FROM app_settings');
    const S = {}; settRows.forEach(r => { S[r.key] = r.value; });

    // ── Document identity ──
    const isWO    = po.tracker_type === 'wo';
    const docTitle = isWO ? 'WORK ORDER' : 'PURCHASE ORDER';
    const formNo   = isWO ? 'BCIM-WO-F-01' : 'BCIM-PO-F-01';
    const coName   = S.company_name   || 'BCIM ENGINEERING PRIVATE LIMITED';
    const coWing   = S.company_wing   || '"B" Wing, DivyaSree Chambers';
    const coAddr   = S.company_address|| 'No. 11, O\'Shaugnessy Road, Bangalore - 560 025';
    const coGstin  = S.company_gstin  || '';
    const coFooter = coAddr;
    const LOGO_PATH = require('path').join(__dirname, 'public', 'logo.jpeg');
    const hasLogo   = require('fs').existsSync(LOGO_PATH);

    // ── Page & layout constants ──
    const PAGE_W = 595.28, PAGE_H = 841.89;
    const LM = 28, RM = 28, TM = 14;
    const TW = PAGE_W - LM - RM; // 539.28
    // Table columns: Sl No | Description | UOM | Quantity | Rate | Amount | Heads
    const CW  = [22, 268, 34, 44, 60, 58, 53]; // sum=539
    const CHD = ['Sl No','Description','UOM','Quantity','Rate','Amount','Heads'];
    const CAL = ['center','left','center','center','right','right','left'];
    const FOOTER_H = 30, SIG_H = 30;
    const CONTENT_B = PAGE_H - TM - FOOTER_H - SIG_H - 6; // ~762

    // ── Helpers ──
    const fInt = n => { const v2=Math.round(parseFloat(n)||0); return v2.toLocaleString('en-IN'); };
    const fDec = n => { const v2=parseFloat(n)||0; return v2.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); };

    function numWords(n) {
      n = Math.round(parseFloat(n)||0);
      const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
        'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      function b1000(x){
        if(x<20)return ones[x];
        if(x<100)return tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:'');
        return ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+b1000(x%100):'');
      }
      if(n===0)return 'Zero Only.';
      let p=[];
      if(n>=10000000){p.push(b1000(Math.floor(n/10000000))+' Crore');n%=10000000;}
      if(n>=100000) {p.push(b1000(Math.floor(n/100000))+' Lakh');  n%=100000;}
      if(n>=1000)   {p.push(b1000(Math.floor(n/1000))+' Thousand');n%=1000;}
      if(n>0)        p.push(b1000(n));
      return p.join(' ')+' Only.';
    }

    // ── Compute totals ──
    let subTotal = 0;
    const gstGroups = {}; // { rate: totalGstAmt }
    items.forEach(it => {
      const basic = parseFloat(it.amount) || ((parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0));
      const gPct  = parseFloat(it.gst_pct)||0;
      const gAmt  = parseFloat(it.gst_amt)||parseFloat((basic*gPct/100).toFixed(2));
      subTotal += basic;
      if(gPct>0) gstGroups[gPct] = (gstGroups[gPct]||0) + gAmt;
    });
    const totalGst   = Object.values(gstGroups).reduce((a,b)=>a+b,0);
    const grandTotal = subTotal + totalGst;

    // ── T&C list ──
    const vendorContact = [v.contact_person, v.phone].filter(Boolean).join('  ');
    const tcList = [
      'All Bills and DCs should contain the Reference of the Concerned PO .',
      'All materials supplied will be subject to inspections & test when received at our site.',
      'Final Bill shall be cleared after Certification by the Concerned Engg & on actual measurements taken at Site.',
      'If any Goods damaged or rejected must be replaced inimediately at the suppliers own expenses.',
      S.payment_terms || 'Payment : 60 Days from the date of supply',
      S.lead_time     || 'Lead Time : Within 2-3 days from the date of order',
      ...(vendorContact ? ['Contact details of Supplier: '+vendorContact] : []),
      'Bill Requirement: Bill must carry details of Specific Order number, site acceptance signature along with seal, buyer and supplier GST number, HSN Code, Bill number, LUT details, Transporter challan etc.',
      'Quantity Certification: Quantity mentioned in the Order may be approximate, actual & mutually certified measurement will be accounted for the payment.',
      'Price Escalation: Above mentioned in price is absolute frozen for this Order, in case of any price escalation \u201cafter\u201d or \u201cbefore/ in-between\u201d will be considered breach of Contract terms & will not be entertained.',
      'Cancellation: Time is of the essence in this order. Buyer reserves the right to cancel this order, or any portion of this order, without liability, if; (1) delivery is not made when and as specified; (b) Seller fails to meet contract commitments as to exact time, price, quality or quantity',
      'Any dispute or difference which may arise between the parties or their representatives shall be referred to two arbitrators to be nominated by each of the dissenting parties and the decision of the arbitrators shall be final and binding on the concerned parties and the proceedings shall be governed by the Arbitration and Conciliation Act 1996. All disputes shall be subject to jurisdiction of courts at Bangalore.',
      'GST TERMS:- a. Payment Clause: In an event of denial of credits to M/s. BCIM ENGINEERING PRIVATE LIMITED arising, on account of any non-payment of taxes or non-compliance with the GST Laws by the Vendor, BCIM ENGINEERING PRIVATE LIMITED shall withhold such amounts from the subsequent payments to the M/s. '+(po.vendor||'Vendor')+'., till the input tax credit so denied is reinstated and reflected in the returns of BCIM ENGINEERING PRIVATE LIMITED In such cases BCIM ENGINEERING PRIVATE LIMITED shall be entitled to recover interest at the percent as specified in the Act and as amended time to time',
      'NOTE: 3 Copies of Tax invoice (original, duplicate & triplicate) to be submitted along with each consignment supply',
      'Order to be acknowledged and accepted or to be reverted if any changes within 4 hours. If not it will be considered as accepted',
    ];

    // ── PDF document (bufferPages for page numbering) ──
    const doc = new PDFDocument({ size:'A4', bufferPages:true, autoFirstPage:true,
      margins:{top:TM,bottom:TM,left:LM,right:RM} });
    const chunks=[];
    doc.on('data', d=>chunks.push(d));
    doc.on('end', ()=>{
      const buf=Buffer.concat(chunks);
      res.setHeader('Content-Type','application/pdf');
      res.setHeader('Content-Disposition',`inline; filename="${isWO?'WO':'PO'}_${pn}.pdf"`);
      res.send(buf);
    });

    function hline(y,thick=0.5,col='#888'){
      doc.save().moveTo(LM,y).lineTo(PAGE_W-RM,y).lineWidth(thick).strokeColor(col).stroke().restore();
    }

    // ── Draw full page-1 header: returns y after "We hereby place..." ──
    function drawMainHeader() {
      let y = TM;
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor('#000')
        .text(formNo, PAGE_W-RM-88, y+1, {width:88,align:'right'}).restore();
      // Logo
      if(hasLogo){
        doc.image(LOGO_PATH, LM, y, {height:24, fit:[60,24]});
      } else {
        doc.save().rect(LM,y,26,20).lineWidth(1.5).strokeColor('#1a5276').stroke().restore();
        doc.save().font('Helvetica-Bold').fontSize(13).fillColor('#1a5276')
          .text('3',LM+1,y+1,{width:24,align:'center'}).restore();
        doc.save().font('Helvetica-Bold').fontSize(7).fillColor('#1a5276')
          .text('BCIM',LM+1,y+13,{width:24,align:'center'}).restore();
      }
      // Title
      doc.save().font('Helvetica-Bold').fontSize(12).fillColor('#000')
        .text(docTitle,LM+64,y+5,{width:TW-64,align:'center'}).restore();
      y+=28; hline(y,1,'#000'); y+=3;

      // Company (left) | PO info (right)
      const piW=190, piX=PAGE_W-RM-piW;
      doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000').text(coName,LM,y).restore();
      doc.save().font('Helvetica').fontSize(7.2).fillColor('#000').text(coWing,LM,y+10).restore();
      doc.save().font('Helvetica').fontSize(7.2).fillColor('#000').text(coAddr,LM,y+19).restore();
      doc.save().font('Helvetica-Bold').fontSize(7.2).fillColor('#000').text('GSTIN : '+coGstin,LM,y+28).restore();
      const piRows=[['Project:',po.site_code||po.description||''],['PO No:',po.po_number||''],
        ['Date:',po.po_date||''],['PO Req No:',po.po_req_no||''],
        ['PO Req Date:',po.po_req_date||''],['Approval No:',po.approval_no||'']];
      let ry=y;
      piRows.forEach(([l,v2])=>{
        doc.save().font('Helvetica').fontSize(7.5).fillColor('#000').text(l,piX,ry,{width:72,lineBreak:false}).restore();
        doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor('#000').text(v2,piX+72,ry,{width:piW-72,lineBreak:false}).restore();
        ry+=11;
      });
      y=Math.max(y+38,ry)+5;
      hline(y,0.3,'#ccc'); y+=4;

      // Vendor (left) | Delivery (right)
      const delW=210, delX=PAGE_W-RM-delW, vendW=delX-LM-8;
      let vy=y;
      doc.save().font('Helvetica').fontSize(7.5).fillColor('#000').text('To,',LM,vy).restore(); vy+=10;
      doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000').text('M/s. '+(po.vendor||''),LM,vy,{width:vendW}).restore(); vy+=11;
      const vLines=[v.address, v.city,
        v.email?'Email: '+v.email:null,
        (v.contact_person||v.phone)?'Contact person: '+(v.contact_person||'')+(v.phone?'  '+v.phone:''):null,
        v.gstin?'GST: '+v.gstin:null].filter(Boolean);
      vLines.forEach(ln=>{ doc.save().font('Helvetica').fontSize(7).fillColor('#000').text(ln,LM,vy,{width:vendW,lineBreak:false,ellipsis:true}).restore(); vy+=9; });

      let dy=y;
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor('#000')
        .text('DELIVERY ADDRESS:-',delX,dy,{underline:true}).restore(); dy+=11;
      if(po.site_code||po.description){
        doc.save().font('Helvetica-Bold').fontSize(7.2).fillColor('#000')
          .text('Project: '+(po.site_code||po.description||''),delX,dy,{width:delW}).restore(); dy+=9;
      }
      if(po.delivery_address){
        String(po.delivery_address).split('\n').filter(Boolean).forEach(dl=>{
          doc.save().font('Helvetica').fontSize(7).fillColor('#000')
            .text(dl.trim(),delX,dy,{width:delW,lineBreak:false,ellipsis:true}).restore(); dy+=8.5;
        });
      }
      if(po.delivery_contact){
        doc.save().font('Helvetica').fontSize(7).fillColor('#000')
          .text('Contact Person: '+po.delivery_contact,delX,dy,{width:delW,lineBreak:false,ellipsis:true}).restore(); dy+=8.5;
      }
      y=Math.max(vy,dy)+4;
      hline(y,0.3,'#aaa'); y+=3;
      doc.save().font('Helvetica').fontSize(7).fillColor('#000')
        .text('We hereby place an order on you for supply of the following materials with same terms and conditions as per original order.',LM,y,{width:TW}).restore();
      y+=10;
      return y;
    }

    // ── Draw form-number-only mini-header for continuation pages ──
    function drawContinuationHeader() {
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor('#000')
        .text(formNo,PAGE_W-RM-88,TM+1,{width:88,align:'right'}).restore();
      return TM+16;
    }

    // ── Table header row ──
    function drawTableHeader(y) {
      const H=13; let x=LM;
      CHD.forEach((h,i)=>{
        doc.save().rect(x,y,CW[i],H).fillColor('#f0f0f0').fill().restore();
        doc.save().rect(x,y,CW[i],H).lineWidth(0.5).strokeColor('#666').stroke().restore();
        doc.save().font('Helvetica-Bold').fontSize(7).fillColor('#000')
          .text(h,x+2,y+3,{width:CW[i]-4,align:CAL[i],lineBreak:false}).restore();
        x+=CW[i];
      });
      return y+H;
    }

    // ── Single item row (variable height based on description) ──
    function drawItemRow(it, y) {
      const desc=String(it.description||'');
      doc.font('Helvetica').fontSize(7.5);
      const descH=doc.heightOfString(desc,{width:CW[1]-6,lineBreak:true});
      const rowH=Math.max(16,descH+8);
      const basic=parseFloat(it.amount)||((parseFloat(it.quantity)||0)*(parseFloat(it.rate)||0));
      const rate=parseFloat(it.rate)||0;
      const vals=[
        String(it.sl_no||''),
        desc,
        String(it.uom||''),
        (it.quantity!=null&&it.quantity!=='') ? fDec(it.quantity) : '',
        rate>0 ? fDec(rate) : '',
        basic>0 ? fDec(basic) : '',
        String(it.heads||''),
      ];
      let x=LM;
      vals.forEach((v2,i)=>{
        doc.save().rect(x,y,CW[i],rowH).lineWidth(0.3).strokeColor('#aaa').stroke().restore();
        doc.save().font('Helvetica').fontSize(7.5).fillColor('#000')
          .text(v2,x+3,y+4,{width:CW[i]-6,height:rowH-8,align:CAL[i],lineBreak:(i===1),ellipsis:(i!==1)}).restore();
        x+=CW[i];
      });
      return y+rowH;
    }

    // ── Empty filler row ──
    function drawEmptyRow(y) {
      let x=LM;
      CW.forEach(w=>{ doc.save().rect(x,y,w,14).lineWidth(0.3).strokeColor('#ccc').stroke().restore(); x+=w; });
      return y+14;
    }

    // ── Totals block ── returns new Y
    // totX is calculated so the value column right-aligns with the Amount column (CW[5]) right edge,
    // not the full table right edge (which would overflow into the Heads column).
    function drawTotals(y) {
      const lblW=128, valW=70;
      const amtColRight = LM + CW.slice(0,6).reduce((a,b)=>a+b,0); // right edge of Amount col = 514
      const totX = amtColRight - lblW - valW - 2;
      function totRow(lbl,val,bold){
        const f=bold?'Helvetica-Bold':'Helvetica';
        doc.save().font(f).fontSize(8).fillColor('#000')
          .text(lbl,totX,y,{width:lblW,align:'right',lineBreak:false}).restore();
        doc.save().font(f).fontSize(8).fillColor('#000')
          .text(val,totX+lblW+2,y,{width:valW-2,align:'right',lineBreak:false}).restore();
        y+=13;
      }
      totRow('Sub Total',fInt(subTotal),false);
      Object.keys(gstGroups).sort((a,b)=>parseFloat(a)-parseFloat(b)).forEach(rate=>{
        const total=gstGroups[rate];
        const half=parseFloat(rate)/2;
        const h1=Math.round(total/2), h2=Math.round(total-h1);
        totRow('CGST @ '+half+'%',fInt(h1),false);
        totRow('SGST @ '+half+'%',fInt(h2),false);
      });
      hline(y,0.8,'#000'); y+=2;
      totRow('Grand Total',fInt(grandTotal),true);
      return y;
    }

    // ── Post-process: draw signature + footer on every page ──
    function drawSigAndFooter(pgNum,totalPgs) {
      const sy=PAGE_H-TM-FOOTER_H-SIG_H;
      hline(sy,0.5,'#888');
      doc.save().font('Helvetica').fontSize(7.5).fillColor('#000').text('Checked by',LM,sy+4).restore();
      doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000').text('Director',LM+TW/2-20,sy+16).restore();
      doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000')
        .text('Managing Director',PAGE_W-RM-90,sy+16,{width:90,align:'right'}).restore();
      const fy=PAGE_H-TM-FOOTER_H+2;
      hline(fy,0.5,'#666');
      doc.save().font('Helvetica-Bold').fontSize(7).fillColor('#000')
        .text(coName,LM,fy+5,{width:TW,align:'center'}).restore();
      doc.save().font('Helvetica').fontSize(6.5).fillColor('#444')
        .text('"B" Wing, DivyaSree Chambers, No. 11, O\'Shaugnessy Road,  Bangalore-560 025.',LM,fy+14,{width:TW-55,align:'center'}).restore();
      doc.save().font('Helvetica').fontSize(6.5).fillColor('#444')
        .text('Page '+pgNum+' of '+totalPgs,PAGE_W-RM-50,fy+14,{width:50,align:'right'}).restore();
    }

    // ═══════════════════════════════
    // RENDER
    // ═══════════════════════════════
    let y = drawMainHeader();
    y = drawTableHeader(y);

    // Items
    for(let i=0;i<items.length;i++){
      const it=items[i];
      const desc=String(it.description||'');
      doc.font('Helvetica').fontSize(7.5);
      const descH=doc.heightOfString(desc,{width:CW[1]-6});
      const rowH=Math.max(16,descH+8);
      if(y+rowH>CONTENT_B){
        while(y+14<=CONTENT_B-2){ y=drawEmptyRow(y); }
        doc.addPage();
        y=drawContinuationHeader();
        y=drawTableHeader(y);
      }
      y=drawItemRow(it,y);
    }
    // Filler rows (min 3 blank rows after items)
    const minFill=Math.max(0,3-items.length);
    for(let b=0;b<minFill;b++){ if(y+14<=CONTENT_B-2) y=drawEmptyRow(y); }

    y+=6;

    // Totals
    const gstCount=Object.keys(gstGroups).length;
    const totH=(1+gstCount*2+1)*13+10;
    if(y+totH>CONTENT_B){ doc.addPage(); y=drawContinuationHeader(); }
    y=drawTotals(y);
    y+=6;

    // Rupees
    doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000')
      .text('Rupees: '+numWords(grandTotal),LM,y,{width:TW,underline:true}).restore();
    y+=13;

    // Narration
    if(po.narration||po.description){
      doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000')
        .text('Narration: ',LM,y,{continued:true})
        .font('Helvetica').fontSize(8)
        .text(po.narration||po.description||'',{width:TW-60,lineBreak:false}).restore();
      y+=13;
    }
    y+=4;

    // T&C
    doc.save().font('Helvetica-Bold').fontSize(8).fillColor('#000').text('Terms & Conditions:',LM,y).restore();
    y+=11;
    for(let ti=0;ti<tcList.length;ti++){
      const txt=tcList[ti];
      doc.font('Helvetica').fontSize(7.5);
      const th=doc.heightOfString(txt,{width:TW-18})+4;
      if(y+th>CONTENT_B){ doc.addPage(); y=drawContinuationHeader(); }
      doc.save().font('Helvetica').fontSize(7.5).fillColor('#000')
        .text(String(ti+1),LM,y,{width:16,lineBreak:false}).restore();
      doc.save().font('Helvetica').fontSize(7.5).fillColor('#000')
        .text(txt,LM+16,y,{width:TW-16}).restore();
      y+=th;
    }

    // Post-process: add signature + footer to every page
    const range=doc.bufferedPageRange();
    const totalPages=range.count;
    for(let pg=0;pg<totalPages;pg++){
      doc.switchToPage(range.start+pg);
      drawSigAndFooter(pg+1,totalPages);
    }
    doc.flushPages();
    doc.end();
  } catch(err) {
    console.error('Print error:', err.message);
    if(!res.headersSent) res.status(500).json({ ok:false, error:err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// MATERIAL TRACKER ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

app.get('/api/material-tracker/meta', (req, res) => {
  try {
    const heads = query(`SELECT id, name, code, sort_order
                         FROM material_tracker_heads
                         WHERE is_active=1
                         ORDER BY sort_order, name`);
    const teams = query(`SELECT id, name, code, sort_order
                         FROM material_tracker_teams
                         WHERE is_active=1
                         ORDER BY sort_order, name`);
    const stockItems = query(`SELECT item_code, item_name, unit, gst_pct, category
                              FROM stock_items
                              WHERE is_active=1
                              ORDER BY category, item_name`);
    const summary = query(`SELECT
      COUNT(*) AS total_rows,
      COALESCE(SUM(po_value_with_tax), 0) AS total_po_value,
      COALESCE(SUM(total_amount_certified_by_qs), 0) AS total_certified_amount,
      SUM(CASE WHEN workflow_status IN ('Draft','MR Raised') THEN 1 ELSE 0 END) AS phase1_pending,
      SUM(CASE WHEN workflow_status='MR Certified' THEN 1 ELSE 0 END) AS phase2_pending,
      SUM(CASE WHEN workflow_status='PO Raised' THEN 1 ELSE 0 END) AS phase3_pending,
      SUM(CASE WHEN workflow_status='With Accounts' THEN 1 ELSE 0 END) AS completed_rows
      FROM material_tracker_items
      WHERE is_deleted=0 AND project_id=?`, [req.projectId || 0])[0] || {};
    res.json({ ok: true, heads, teams, stock_items: stockItems, summary });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function saveMtLineItems(trackerId, lineItems, projectId) {
  run('DELETE FROM material_tracker_line_items WHERE tracker_id=?', [trackerId]);
  if (!Array.isArray(lineItems) || !lineItems.length) return;
  lineItems.forEach((row, i) => {
    const qty      = parseFloat(row.qty)       || 0;
    const rate     = parseFloat(row.rate)      || 0;
    const gstPct   = parseFloat(row.gst_pct)   || 0;
    const basicAmt = parseFloat(row.basic_amt) || (qty * rate);
    const gstAmt   = parseFloat(row.gst_amt)   || parseFloat((basicAmt * gstPct / 100).toFixed(2));
    const totalAmt = parseFloat(row.total_amt) || parseFloat((basicAmt + gstAmt).toFixed(2));
    run(`INSERT INTO material_tracker_line_items
         (tracker_id, sl_no, item_code, description, uom, qty, rate, basic_amt, gst_pct, gst_amt, total_amt, head_name, project_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [trackerId, i + 1, mtText(row.item_code), mtText(row.description), mtText(row.uom) || 'Nos',
       qty, rate, parseFloat(basicAmt.toFixed(2)), gstPct,
       parseFloat(gstAmt.toFixed(2)), parseFloat(totalAmt.toFixed(2)),
       mtText(row.head_name), projectId || 0]);
  });
}

app.get('/api/material-tracker', (req, res) => {
  try {
    const conditions = ['m.is_deleted=0', 'm.project_id=?'];
    const params = [req.projectId || 0];
    const search = mtText(req.query.search || '');
    const head   = mtText(req.query.head   || '');
    const team   = mtText(req.query.team   || '');
    const status   = mtText(req.query.status    || '');
    const dateFrom = mtText(req.query.date_from || '');
    const dateTo   = mtText(req.query.date_to   || '');
    if (head)     { conditions.push('m.head_name=?');        params.push(head); }
    if (team)     { conditions.push('m.team_name=?');        params.push(team); }
    if (status)   { conditions.push('m.workflow_status=?');  params.push(status); }
    if (dateFrom) { conditions.push('m.mr_date >= ?');       params.push(dateFrom); }
    if (dateTo)   { conditions.push('m.mr_date <= ?');       params.push(dateTo); }
    if (search) {
      conditions.push(`(
        LOWER(m.tracker_no) LIKE ? OR LOWER(m.mr_no) LIKE ? OR LOWER(m.vendor_name) LIKE ? OR
        LOWER(m.po_no) LIKE ? OR LOWER(m.invoice_number) LIKE ? OR
        EXISTS (SELECT 1 FROM material_tracker_line_items l WHERE l.tracker_id=m.id AND LOWER(l.description) LIKE ?)
      )`);
      const q = `%${search.toLowerCase()}%`;
      params.push(q, q, q, q, q, q);
    }
    const items = query(`SELECT m.*,
      (SELECT GROUP_CONCAT(l.description,' | ') FROM material_tracker_line_items l WHERE l.tracker_id=m.id ORDER BY l.sl_no) AS line_descriptions,
      (SELECT COUNT(*) FROM material_tracker_line_items l WHERE l.tracker_id=m.id) AS line_count
      FROM material_tracker_items m
      WHERE ${conditions.join(' AND ')}
      ORDER BY m.id DESC`, params);
    res.json({ ok: true, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/material-tracker/:id', (req, res) => {
  try {
    const item = query(`SELECT * FROM material_tracker_items
                        WHERE id=? AND is_deleted=0 AND project_id=?`,
      [req.params.id, req.projectId || 0])[0];
    if (!item) return res.status(404).json({ ok: false, error: 'Tracker row not found' });
    const lineItems = query(`SELECT * FROM material_tracker_line_items
                             WHERE tracker_id=? ORDER BY sl_no`, [item.id]);
    res.json({ ok: true, item: { ...item, line_items: lineItems } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/material-tracker', (req, res) => {
  try {
    if (req.dept !== 'stores' && req.dept !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Only Stores/Admin can create tracker rows' });
    }
    const project = query('SELECT name, code FROM projects WHERE id=?', [req.projectId || 0])[0] || {};
    const lineItems = Array.isArray(req.body.line_items) ? req.body.line_items : [];
    const scopedBody = filterMaterialTrackerPayloadByDept(req.body || {}, req.dept, true);
    // Derive item_description from first line item if not provided
    if (!scopedBody.item_description && lineItems.length) scopedBody.item_description = lineItems[0].description || '';
    const payload = normalizeMaterialTrackerPayload(scopedBody, {
      projectId: req.projectId,
      projectName: project.name || '',
      projectCode: project.code || '',
      userName: req.userName || req.userEmail || req.dept || 'system'
    });
    if (!lineItems.length && !payload.mr_no) {
      return res.status(400).json({ ok: false, error: 'Enter at least one line item or MR No' });
    }
    const trackerNo = nextMaterialTrackerNo();
    const cols = Object.keys(payload);
    run(`INSERT INTO material_tracker_items
      (tracker_no, ${cols.join(', ')}, created_by)
      VALUES (?, ${cols.map(() => '?').join(', ')}, ?)`,
      [trackerNo, ...cols.map(k => payload[k]), mtText(req.userName || req.userEmail || req.dept || 'system')]);
    const newId = query('SELECT last_insert_rowid() AS id')[0].id;
    saveMtLineItems(newId, lineItems, req.projectId);
    saveDb();
    res.json({ ok: true, tracker_no: trackerNo });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put('/api/material-tracker/:id', (req, res) => {
  try {
    const current = query(`SELECT * FROM material_tracker_items
                           WHERE id=? AND is_deleted=0 AND project_id=?`,
      [req.params.id, req.projectId || 0])[0];
    if (!current) return res.status(404).json({ ok: false, error: 'Tracker row not found' });
    const lineItems = Array.isArray(req.body.line_items) ? req.body.line_items : null;
    const scopedBody = filterMaterialTrackerPayloadByDept(req.body || {}, req.dept, false);
    // Derive item_description from first line item if stores is saving with no description
    if (lineItems && lineItems.length && !scopedBody.item_description) {
      scopedBody.item_description = lineItems[0].description || '';
    }
    if (req.dept !== 'admin' && !Object.keys(scopedBody).length && lineItems === null) {
      return res.status(403).json({ ok: false, error: 'You can update only your team section in this tracker row' });
    }
    const payload = normalizeMaterialTrackerPayload({ ...current, ...scopedBody }, {
      projectId: current.project_id || req.projectId,
      projectName: current.project_name,
      projectCode: current.project_code,
      userName: req.userName || req.userEmail || req.dept || 'system'
    });
    const cols = Object.keys(payload);
    run(`UPDATE material_tracker_items
         SET ${cols.map(k => `${k}=?`).join(', ')},
             updated_at=datetime('now','localtime')
         WHERE id=?`,
      [...cols.map(k => payload[k]), req.params.id]);
    if (lineItems !== null && (req.dept === 'stores' || req.dept === 'admin')) {
      saveMtLineItems(req.params.id, lineItems, current.project_id || req.projectId);
    }
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete('/api/material-tracker/:id', (req, res) => {
  try {
    if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Only admin can delete tracker rows' });
    run(`UPDATE material_tracker_items
         SET is_deleted=1, updated_by=?, updated_at=datetime('now','localtime')
         WHERE id=? AND project_id=?`,
      [mtText(req.userName || req.userEmail || req.dept || 'system'), req.params.id, req.projectId || 0]);
    run('DELETE FROM material_tracker_line_items WHERE tracker_id=?', [req.params.id]);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── MR PRINT (PDF) ──────────────────────────────────────────────────────────
app.get('/api/material-tracker/:id/print', (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const item = query(`SELECT * FROM material_tracker_items
                        WHERE id=? AND is_deleted=0 AND project_id=?`,
      [req.params.id, req.projectId || 0])[0];
    if (!item) return res.status(404).json({ ok: false, error: 'MR not found' });
    const lineItems = query(`SELECT * FROM material_tracker_line_items
                             WHERE tracker_id=? ORDER BY sl_no`, [item.id]);
    const settRows = query('SELECT key,value FROM app_settings');
    const S = {}; settRows.forEach(r => { S[r.key] = r.value; });
    const coName   = S.company_name    || 'BCIM ENGINEERING PRIVATE LIMITED';
    const coAddr   = S.company_address || 'No. 11, O\'Shaugnessy Road, Bangalore - 560 025';
    const LOGO_PATH = require('path').join(__dirname, 'public', 'logo.jpeg');
    const hasLogo   = require('fs').existsSync(LOGO_PATH);

    const PAGE_W = 595.28, PAGE_H = 841.89;
    const LM = 36, RM = 36, TM = 28;
    const TW = PAGE_W - LM - RM;
    const fDec = n => (parseFloat(n)||0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="MR-${item.tracker_no}.pdf"`);
      res.send(pdf);
    });

    let y = TM;

    // ── Logo + Header ─────────────────────────────────────────────────────────
    if (hasLogo) {
      try { doc.image(LOGO_PATH, LM, y, { height: 48, fit: [120, 48] }); } catch(e) {}
    }
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000')
       .text(coName, LM + 130, y + 4, { width: TW - 130, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#555')
       .text(coAddr, LM + 130, y + 20, { width: TW - 130, align: 'center' });
    y += 56;

    // Title bar
    doc.rect(LM, y, TW, 18).fillAndStroke('#1e3a5f', '#1e3a5f');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff')
       .text('MATERIAL REQUISITION (MR)', LM, y + 4, { width: TW, align: 'center' });
    y += 24;

    // Info grid — 2 column
    const infoRows = [
      ['Tracker No', item.tracker_no || '', 'MR No', item.mr_no || ''],
      ['MR Date', item.mr_date || '', 'Material Required Date', item.material_required_date || ''],
      ['Project', item.project_name || '', 'Project Code', item.project_code || ''],
      ['Team', item.team_name || '', 'Head', item.head_name || ''],
      ['Responsibility', item.responsibility || '', 'Status', item.workflow_status || 'Draft']
    ];
    const col1w = TW * 0.20, col2w = TW * 0.30;
    infoRows.forEach(([l1, v1, l2, v2]) => {
      doc.rect(LM, y, TW, 16).strokeColor('#ccc').stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#444')
         .text(l1 + ':', LM + 4, y + 4, { width: col1w - 4 });
      doc.font('Helvetica').fontSize(8).fillColor('#000')
         .text(v1, LM + col1w, y + 4, { width: col2w - 4 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#444')
         .text(l2 + ':', LM + col1w + col2w + 4, y + 4, { width: col1w - 4 });
      doc.font('Helvetica').fontSize(8).fillColor('#000')
         .text(v2, LM + col1w*2 + col2w, y + 4, { width: col2w - 4 });
      y += 16;
    });
    y += 8;

    // ── Line items table ──────────────────────────────────────────────────────
    const CW = [22, 0, 40, 48, 60, 60, 52, 60, 68, 70]; // description fills remainder
    CW[1] = TW - CW.reduce((a,b,i) => i===1 ? a : a+b, 0);
    const CHD = ['Sl','Description','UOM','Qty','Rate (₹)','Basic Amt','GST %','GST Amt','Total Amt','Head'];
    const CAL = ['center','left','center','right','right','right','center','right','right','center'];

    // Table header
    doc.rect(LM, y, TW, 16).fill('#f0f4f8');
    let cx = LM;
    CHD.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1e3a5f')
         .text(h, cx + 2, y + 4, { width: CW[i] - 4, align: CAL[i], lineBreak: false });
      cx += CW[i];
    });
    doc.rect(LM, y, TW, 16).strokeColor('#aaa').stroke();
    y += 16;

    // Table rows
    let basicTotal = 0, gstTotal = 0, grandTotal = 0;
    (lineItems.length ? lineItems : []).forEach((row, ri) => {
      const rowH = 18;
      if (y + rowH > PAGE_H - 80) { doc.addPage(); y = TM; }
      if (ri % 2 === 0) doc.rect(LM, y, TW, rowH).fill('#fafbfc');
      doc.rect(LM, y, TW, rowH).strokeColor('#ddd').stroke();
      cx = LM;
      const rowData = [
        String(row.sl_no || ri + 1),
        row.description || '',
        row.uom || '',
        fDec(row.qty),
        fDec(row.rate),
        fDec(row.basic_amt),
        (parseFloat(row.gst_pct)||0) + '%',
        fDec(row.gst_amt),
        fDec(row.total_amt),
        row.head_name || ''
      ];
      rowData.forEach((v, i) => {
        doc.font('Helvetica').fontSize(7.5).fillColor('#000')
           .text(v, cx + 2, y + 5, { width: CW[i] - 4, align: CAL[i], lineBreak: false });
        cx += CW[i];
      });
      basicTotal += parseFloat(row.basic_amt) || 0;
      gstTotal   += parseFloat(row.gst_amt)   || 0;
      grandTotal += parseFloat(row.total_amt) || 0;
      y += rowH;
    });

    // Totals row
    doc.rect(LM, y, TW, 18).fill('#e8f0fe');
    doc.rect(LM, y, TW, 18).strokeColor('#aaa').stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
       .text('TOTAL', LM + 2, y + 5, { width: CW[0]+CW[1]+CW[2]+CW[3]+CW[4]-4, align: 'right' });
    const totX = LM + CW[0]+CW[1]+CW[2]+CW[3]+CW[4];
    doc.text(fDec(basicTotal), totX + 2, y + 5, { width: CW[5]-4, align: 'right' });
    doc.text('', totX+CW[5]+2, y+5, { width: CW[6]-4 });
    doc.text(fDec(gstTotal),   totX+CW[5]+CW[6]+2, y+5, { width: CW[7]-4, align: 'right' });
    doc.text(fDec(grandTotal), totX+CW[5]+CW[6]+CW[7]+2, y+5, { width: CW[8]-4, align: 'right' });
    y += 26;

    // ── Certification section ────────────────────────────────────────────────
    if (y + 80 > PAGE_H - 50) { doc.addPage(); y = TM; }
    y += 6;
    doc.rect(LM, y, TW, 14).fill('#f0f4f8');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e3a5f')
       .text('CERTIFICATION', LM + 4, y + 3);
    y += 14;

    const certRows = [
      ['PM Certification Date', item.pm_cert_date || '________________', 'QS Certification Date', item.qs_cert_date || '________________'],
      ['Certified Qty (Total)', item.certified_qty ? String(item.certified_qty) : '________________', '', '']
    ];
    certRows.forEach(([l1,v1,l2,v2]) => {
      doc.rect(LM, y, TW, 16).strokeColor('#ccc').stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#444').text(l1+':', LM+4, y+4, { width: col1w-4 });
      doc.font('Helvetica').fontSize(8).fillColor('#000').text(v1, LM+col1w, y+4, { width: col2w-4 });
      if (l2) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#444').text(l2+':', LM+col1w+col2w+4, y+4, { width: col1w-4 });
        doc.font('Helvetica').fontSize(8).fillColor('#000').text(v2, LM+col1w*2+col2w, y+4, { width: col2w-4 });
      }
      y += 16;
    });
    y += 16;

    // ── Signature boxes ──────────────────────────────────────────────────────
    if (y + 70 > PAGE_H - 30) { doc.addPage(); y = TM; }
    const sigW = TW / 4;
    const sigs = ['Raised By (Stores)', 'PM Approval', 'QS Certification', 'Procurement'];
    sigs.forEach((label, i) => {
      const sx = LM + i * sigW;
      doc.rect(sx, y, sigW, 55).strokeColor('#ccc').stroke();
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#555')
         .text(label, sx + 4, y + 4, { width: sigW - 8, align: 'center' });
      doc.font('Helvetica').fontSize(7).fillColor('#888')
         .text('Signature:', sx + 4, y + 30, { width: sigW - 8 })
         .text('Date:', sx + 4, y + 43, { width: sigW - 8 });
    });

    doc.flushPages();
    doc.end();
  } catch(e) {
    console.error('MR print error:', e.message);
    if (!res.headersSent) res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/material-tracker-heads', (req, res) => {
  try {
    const heads = query(`SELECT * FROM material_tracker_heads
                         WHERE is_active=1
                         ORDER BY sort_order, name`);
    res.json({ ok: true, heads });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/material-tracker-heads', (req, res) => {
  try {
    if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Only admin can add heads' });
    const name = mtText(req.body?.name);
    if (!name) return res.status(400).json({ ok: false, error: 'Head name required' });
    run(`INSERT OR IGNORE INTO material_tracker_heads (name, code, sort_order)
         VALUES (?,?,?)`,
      [name, mtText(req.body?.code), Math.round(mtNum(req.body?.sort_order))]);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/material-tracker-teams', (req, res) => {
  try {
    const teams = query(`SELECT * FROM material_tracker_teams
                         WHERE is_active=1
                         ORDER BY sort_order, name`);
    res.json({ ok: true, teams });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/material-tracker-teams', (req, res) => {
  try {
    if (req.dept !== 'admin') return res.status(403).json({ ok: false, error: 'Only admin can add teams' });
    const name = mtText(req.body?.name);
    if (!name) return res.status(400).json({ ok: false, error: 'Team name required' });
    run(`INSERT OR IGNORE INTO material_tracker_teams (name, code, sort_order)
         VALUES (?,?,?)`,
      [name, mtText(req.body?.code), Math.round(mtNum(req.body?.sort_order))]);
    saveDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// STOCK ITEMS ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// GET /api/stock-items
app.get('/api/stock-items', (req, res) => {
  try {
    const items = query('SELECT * FROM stock_items ORDER BY category, item_name');
    res.json({ ok: true, items });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// POST /api/stock-items
app.post('/api/stock-items', (req, res) => {
  try {
    const d = req.body;
    if (!d.item_code || !d.item_name) return res.status(400).json({ ok:false, error:'item_code and item_name required' });
    const exists = query('SELECT item_code FROM stock_items WHERE item_code=?',[d.item_code]);
    if (exists.length) return res.status(409).json({ ok:false, error:'Item code already exists' });
    run(`INSERT INTO stock_items (item_code,item_name,category,unit,gst_pct,reorder_qty,min_stock,last_rate,current_qty,current_value)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [d.item_code, d.item_name, d.category||'', d.unit||'', parseFloat(d.gst_pct)||0,
       parseFloat(d.reorder_qty)||0, parseFloat(d.min_stock)||0, parseFloat(d.last_rate)||0,
       parseFloat(d.current_qty)||0, parseFloat(d.current_value)||((parseFloat(d.current_qty)||0) * (parseFloat(d.last_rate)||0))]);
    saveDb();
    res.json({ ok:true, item_code:d.item_code });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// PUT /api/stock-items/:code
app.put('/api/stock-items/:code', (req, res) => {
  try {
    const d = req.body;
    run(`UPDATE stock_items SET item_name=?,category=?,unit=?,gst_pct=?,reorder_qty=?,min_stock=?,last_rate=?,current_qty=?,current_value=?,updated_at=datetime('now','localtime')
         WHERE item_code=?`,
      [d.item_name, d.category||'', d.unit||'', parseFloat(d.gst_pct)||0, parseFloat(d.reorder_qty)||0,
       parseFloat(d.min_stock)||0, parseFloat(d.last_rate)||0, parseFloat(d.current_qty)||0,
       parseFloat(d.current_value)||((parseFloat(d.current_qty)||0) * (parseFloat(d.last_rate)||0)), req.params.code]);
    saveDb();
    res.json({ ok:true });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// DELETE /api/stock-items/:code
app.delete('/api/stock-items/:code', (req, res) => {
  try {
    if (req.dept !== 'admin') return res.status(403).json({ ok:false, error:'Only admin can delete stock items' });
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ ok:false, error:'item code required' });
    const exists = query('SELECT item_code FROM stock_items WHERE item_code=?', [code]);
    if (!exists.length) return res.status(404).json({ ok:false, error:'Stock item not found' });
    run('BEGIN IMMEDIATE TRANSACTION');
    try {
      run('DELETE FROM stock_ledger WHERE item_code=?', [code]);
      run('DELETE FROM stock_items WHERE item_code=?', [code]);
      run('COMMIT');
    } catch (err) {
      try { run('ROLLBACK'); } catch (_) {}
      throw err;
    }
    saveDb();
    res.json({ ok:true, item_code:code });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// POST /api/stock-items/import
app.post('/api/stock-items/import', (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ ok:false, error:'items array required' });
    let inserted = 0, updated = 0, skipped = 0;
    for (const raw of items) {
      const itemCode = (raw.item_code || '').trim();
      const itemName = (raw.item_name || '').trim();
      if (!itemCode || !itemName) { skipped++; continue; }
      const payload = [
        itemCode,
        itemName,
        raw.category || '',
        raw.unit || '',
        parseFloat(raw.gst_pct) || 0,
        parseFloat(raw.reorder_qty) || 0,
        parseFloat(raw.min_stock) || 0,
        parseFloat(raw.current_qty) || 0,
        parseFloat(raw.last_rate) || 0,
        parseFloat(raw.current_value) || ((parseFloat(raw.current_qty)||0) * (parseFloat(raw.last_rate)||0))
      ];
      const exists = query('SELECT item_code FROM stock_items WHERE item_code=?', [itemCode]);
      if (exists.length) {
        run(`UPDATE stock_items
          SET item_name=?, category=?, unit=?, gst_pct=?, reorder_qty=?, min_stock=?, current_qty=?, last_rate=?, current_value=?, updated_at=datetime('now','localtime')
          WHERE item_code=?`,
          [itemName, raw.category || '', raw.unit || '', parseFloat(raw.gst_pct) || 0, parseFloat(raw.reorder_qty) || 0,
           parseFloat(raw.min_stock) || 0, parseFloat(raw.current_qty) || 0, parseFloat(raw.last_rate) || 0,
           parseFloat(raw.current_value) || ((parseFloat(raw.current_qty)||0) * (parseFloat(raw.last_rate)||0)), itemCode]);
        updated++;
      } else {
        run(`INSERT INTO stock_items
          (item_code,item_name,category,unit,gst_pct,reorder_qty,min_stock,current_qty,last_rate,current_value)
          VALUES (?,?,?,?,?,?,?,?,?,?)`, payload);
        inserted++;
      }
    }
    saveDb();
    res.json({ ok:true, inserted, updated, skipped, total: items.length });
  } catch(e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// GET /api/stock-ledger/:item_code
app.get('/api/stock-ledger/:item_code', (req, res) => {
  try {
    const rows = query('SELECT * FROM stock_ledger WHERE item_code=? ORDER BY txn_date DESC, id DESC LIMIT 100',[req.params.item_code]);
    const item = query('SELECT * FROM stock_items WHERE item_code=?',[req.params.item_code]);
    res.json({ ok:true, ledger:rows, item: item[0]||null });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// POST /api/stock-adjust — manual receipt or adjustment
app.post('/api/stock-adjust', (req, res) => {
  try {
    const d = req.body;
    if (!d.item_code || !d.txn_type) return res.status(400).json({ ok:false, error:'item_code and txn_type required' });
    const item = query('SELECT * FROM stock_items WHERE item_code=?',[d.item_code]);
    if (!item.length) return res.status(404).json({ ok:false, error:'Item not found' });
    const it = item[0];
    const qty    = parseFloat(d.qty)||0;
    const rate   = parseFloat(d.rate)||parseFloat(it.last_rate)||0;
    const value  = qty * rate;
    const isIn   = ['Receipt','GRN','Opening','Return'].includes(d.txn_type);
    const qtyIn  = isIn ? qty : 0;
    const qtyOut = isIn ? 0 : qty;
    const valIn  = isIn ? value : 0;
    const valOut = isIn ? 0 : value;
    const newQty = parseFloat(it.current_qty) + qtyIn - qtyOut;
    const newVal = Math.max(0, parseFloat(it.current_value) + valIn - valOut);
    const newRate= newQty > 0 ? newVal/newQty : rate;
    run(`INSERT INTO stock_ledger (item_code,txn_date,txn_type,ref_type,ref_id,indent_no,bill_sl,qty_in,qty_out,rate,value_in,value_out,balance_qty,balance_value,narration,recorded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.item_code, d.txn_date||new Date().toISOString().slice(0,10), d.txn_type,
       d.ref_type||'', d.ref_id||'', d.indent_no||'', d.bill_sl||'',
       qtyIn, qtyOut, rate, valIn, valOut, newQty, newVal, d.narration||'', d.recorded_by||'']);
    run(`UPDATE stock_items SET current_qty=?,current_value=?,last_rate=?,updated_at=datetime('now','localtime') WHERE item_code=?`,
      [newQty, newVal, newRate, d.item_code]);
    saveDb();
    res.json({ ok:true, new_qty:newQty, new_value:newVal });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// ══════════════════════════════════════════════════════════════════════
// MATERIAL INDENT ENDPOINTS
// ══════════════════════════════════════════════════════════════════════

// GET /api/indents
app.get('/api/indents', (req, res) => {
  try {
    const status = req.query.status || '';
    const type   = req.query.type   || '';
    const conds = ['project_id=?'];
    const params = [req.projectId || 0];
    if (status) { conds.push('status=?'); params.push(status); }
    if (type)   { conds.push('tracker_type=?'); params.push(type); }
    let q = 'SELECT * FROM material_indents WHERE ' + conds.join(' AND ');
    q += ' ORDER BY created_at DESC';
    const indents = query(q, params);
    // Attach item count to each
    indents.forEach(ind => {
      const items = query('SELECT COUNT(*) as cnt FROM indent_items WHERE indent_no=?',[ind.indent_no]);
      ind.item_count = items[0]?.cnt || 0;
    });
    res.json({ ok:true, indents });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// GET /api/indents/:indent_no
app.get('/api/indents/:indent_no', (req, res) => {
  try {
    const rows = query('SELECT * FROM material_indents WHERE indent_no=?',[req.params.indent_no]);
    if (!rows.length) return res.status(404).json({ ok:false, error:'Indent not found' });
    const indent = rows[0];
    indent.items = query('SELECT * FROM indent_items WHERE indent_no=? ORDER BY id',[req.params.indent_no]);
    res.json({ ok:true, indent });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// POST /api/indents — create new indent
app.post('/api/indents', (req, res) => {
  try {
    const d = req.body;
    if (!d.indent_no || !d.raised_by) return res.status(400).json({ ok:false, error:'indent_no and raised_by required' });
    const exists = query('SELECT indent_no FROM material_indents WHERE indent_no=?',[d.indent_no]);
    if (exists.length) return res.status(409).json({ ok:false, error:'Indent number already exists' });
    run(`INSERT INTO material_indents (indent_no,raised_by,raised_date,site_code,purpose,required_date,tracker_type,project_id,status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      [d.indent_no, d.raised_by, d.raised_date||new Date().toISOString().slice(0,10),
       d.site_code||'', d.purpose||'', d.required_date||'',
       d.tracker_type==='wo'?'wo':'po', req.projectId||0, 'Pending Stores']);
    const items = d.items || [];
    items.forEach(it => {
      const estVal = (parseFloat(it.qty_requested)||0) * (parseFloat(it.est_rate)||0);
      run(`INSERT INTO indent_items (indent_no,item_code,item_name,unit,qty_requested,est_rate,est_value,remarks)
           VALUES (?,?,?,?,?,?,?,?)`,
        [d.indent_no, it.item_code||'', it.item_name||it.item_code||'',
         it.unit||'', parseFloat(it.qty_requested)||0,
         parseFloat(it.est_rate)||0, estVal, it.remarks||'']);
    });
    saveDb();
    res.json({ ok:true, indent_no:d.indent_no, item_count:items.length });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// PATCH /api/indents/:indent_no/approve — advance approval stage
app.patch('/api/indents/:indent_no/approve', (req, res) => {
  try {
    const d = req.body;
    const ind = req.params.indent_no;
    const row = query('SELECT * FROM material_indents WHERE indent_no=?',[ind]);
    if (!row.length) return res.status(404).json({ ok:false, error:'Indent not found' });
    const current = row[0];

    // Status machine: Pending Stores → Stores Checked → QS Approved → PM Approved → MD Approved → PO Raised → Closed
    const FLOW = ['Pending Stores','Stores Checked','QS Approved','PM Approved','MD Approved','PO Raised','Closed'];
    const idx = FLOW.indexOf(current.status);

    let sets = [], params = [];
    if (d.action === 'stores_check') {
      sets = ['status=?','stores_checked_by=?','stores_checked_date=?','stores_remarks=?'];
      params = ['Stores Checked', d.by||'', d.date||new Date().toISOString().slice(0,10), d.remarks||''];
      // Also update approved qty on each item
      if (d.items) {
        d.items.forEach(it => {
          run('UPDATE indent_items SET qty_approved=? WHERE id=?',[parseFloat(it.qty_approved)||0, it.id]);
        });
      }
    } else if (d.action === 'qs_approve') {
      sets = ['status=?','qs_approved_by=?','qs_approved_date=?','qs_remarks=?'];
      params = ['QS Approved', d.by||'', d.date||new Date().toISOString().slice(0,10), d.remarks||''];
    } else if (d.action === 'pm_approve') {
      sets = ['status=?','pm_approved_by=?','pm_approved_date=?','pm_remarks=?'];
      params = ['PM Approved', d.by||'', d.date||new Date().toISOString().slice(0,10), d.remarks||''];
    } else if (d.action === 'md_approve') {
      sets = ['status=?','md_approved_by=?','md_approved_date=?','md_remarks=?'];
      params = ['MD Approved', d.by||'', d.date||new Date().toISOString().slice(0,10), d.remarks||''];
    } else if (d.action === 'raise_po') {
      sets = ['status=?','po_number=?'];
      params = ['PO Raised', d.po_number||''];
    } else if (d.action === 'reject') {
      sets = ['status=?'];
      params = ['Rejected'];
    } else {
      return res.status(400).json({ ok:false, error:'Unknown action' });
    }

    sets.push("updated_at=datetime('now','localtime')");
    run(`UPDATE material_indents SET ${sets.join(',')} WHERE indent_no=?`, [...params, ind]);
    saveDb();
    res.json({ ok:true, new_status: params[0] });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// POST /api/indents/:indent_no/issue — issue material from stock against indent
app.post('/api/indents/:indent_no/issue', (req, res) => {
  let txOpen = false;
  try {
    const d = req.body;
    const ind = req.params.indent_no;
    const items = d.items || [];
    if (!items.length) return res.status(400).json({ ok:false, error:'No items to issue' });

    run('BEGIN IMMEDIATE TRANSACTION');
    txOpen = true;
    items.forEach(it => {
      const stockRow = query('SELECT * FROM stock_items WHERE item_code=?',[it.item_code]);
      if (!stockRow.length) return;
      const stock = stockRow[0];
      const currentQty = parseFloat(stock.current_qty) || 0;
      const requestedQty = parseFloat(it.qty_issue) || 0;
      // Clamp issued qty to available stock so ledger and balance stay consistent
      const qty   = Math.min(requestedQty, currentQty);
      if (qty <= 0) return;
      const rate  = parseFloat(stock.last_rate)||0;
      const value = qty * rate;
      const newQty = currentQty - qty;
      const newVal = Math.max(0, parseFloat(stock.current_value) - value);
      run(`INSERT INTO stock_ledger (item_code,txn_date,txn_type,ref_type,ref_id,indent_no,qty_out,rate,value_out,balance_qty,balance_value,narration,recorded_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [it.item_code, d.issue_date||new Date().toISOString().slice(0,10), 'Issue',
         'Indent', ind, ind, qty, rate, value, newQty, newVal,
         `Issued against ${ind} — ${it.narration||''}`, d.issued_by||'']);
      run('UPDATE stock_items SET current_qty=?,current_value=?,updated_at=datetime(\'now\',\'localtime\') WHERE item_code=?',
        [newQty, newVal, it.item_code]);
      run('UPDATE indent_items SET qty_issued=qty_issued+? WHERE indent_no=? AND item_code=?',
        [qty, ind, it.item_code]);
    });
    run('COMMIT');
    txOpen = false;
    saveDb();
    res.json({ ok:true, issued: items.length });
  } catch(e) {
    if (txOpen) { try { run('ROLLBACK'); } catch(_) {} }
    res.status(500).json({ ok:false, error:e.message });
  }
});

// GET /api/stock-alerts — items below reorder level
app.get('/api/stock-alerts', (req, res) => {
  try {
    const alerts = query(`SELECT * FROM stock_items WHERE is_active=1 AND reorder_qty>0 AND current_qty<=reorder_qty ORDER BY (current_qty/reorder_qty) ASC`);
    res.json({ ok:true, alerts });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});

// GET /api/stock-items/seed-defaults — seed the 5 starting categories if empty
app.post('/api/stock-items/seed', (req, res) => {
  try {
    const existing = query('SELECT COUNT(*) as cnt FROM stock_items');
    if (existing[0].cnt > 0) return res.json({ ok:true, msg:'Already has items', seeded:0 });
    const defaults = [
      { item_code:'RMC-M20',   item_name:'Concrete M20 — Ready Mix',         category:'Concrete',   unit:'Cu.M',     reorder_qty:50,   last_rate:5800 },
      { item_code:'RMC-M25',   item_name:'Concrete M25 — Ready Mix',         category:'Concrete',   unit:'Cu.M',     reorder_qty:50,   last_rate:6200 },
      { item_code:'RMC-M30',   item_name:'Concrete M30 — Ready Mix',         category:'Concrete',   unit:'Cu.M',     reorder_qty:30,   last_rate:6800 },
      { item_code:'STL-TMT8',  item_name:'TMT Steel 8mm Fe500D',             category:'Steel',      unit:'MT',       reorder_qty:5,    last_rate:58000 },
      { item_code:'STL-TMT12', item_name:'TMT Steel 12mm Fe500D',            category:'Steel',      unit:'MT',       reorder_qty:5,    last_rate:57000 },
      { item_code:'STL-TMT16', item_name:'TMT Steel 16mm Fe500D',            category:'Steel',      unit:'MT',       reorder_qty:5,    last_rate:56500 },
      { item_code:'STL-TMT20', item_name:'TMT Steel 20mm Fe500D',            category:'Steel',      unit:'MT',       reorder_qty:3,    last_rate:56000 },
      { item_code:'PLY-12MM',  item_name:'Shuttering Plywood 12mm (8x4)',    category:'Plywood',    unit:'Nos',      reorder_qty:100,  last_rate:1050 },
      { item_code:'PLY-18MM',  item_name:'Shuttering Plywood 18mm (8x4)',    category:'Plywood',    unit:'Nos',      reorder_qty:50,   last_rate:1450 },
      { item_code:'BRK-RED',   item_name:'Red Bricks (Class A)',             category:'Bricks',     unit:'Nos',      reorder_qty:5000, last_rate:8 },
      { item_code:'BRK-AAC',   item_name:'AAC Blocks 600x200x150',          category:'Bricks',     unit:'Nos',      reorder_qty:1000, last_rate:52 },
      { item_code:'CEM-OPC',   item_name:'Cement OPC 53 Grade (50kg bag)',   category:'Aggregate',  unit:'Bags',     reorder_qty:200,  last_rate:380 },
      { item_code:'SND-MSND',  item_name:'M-Sand (Manufactured Sand)',       category:'Aggregate',  unit:'Cu.M',     reorder_qty:20,   last_rate:1800 },
      { item_code:'AGG-20MM',  item_name:'Aggregate 20mm Crushed Stone',     category:'Aggregate',  unit:'Cu.M',     reorder_qty:20,   last_rate:1400 },
      { item_code:'AGG-10MM',  item_name:'Aggregate 10mm Crushed Stone',     category:'Aggregate',  unit:'Cu.M',     reorder_qty:10,   last_rate:1600 },
    ];
    defaults.forEach(d => {
      run(`INSERT OR IGNORE INTO stock_items (item_code,item_name,category,unit,reorder_qty,last_rate) VALUES (?,?,?,?,?,?)`,
        [d.item_code, d.item_name, d.category, d.unit, d.reorder_qty, d.last_rate]);
    });
    saveDb();
    res.json({ ok:true, seeded: defaults.length });
  } catch(e) { res.status(500).json({ ok:false, error:e.message }); }
});
