const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const INDENTS_FILE = path.join(DATA_DIR, 'indents.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const VENDORS_FILE = path.join(DATA_DIR, 'vendors.json');
const QUOTATIONS_FILE = path.join(DATA_DIR, 'quotations.json');
const POS_FILE = path.join(DATA_DIR, 'pos.json');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const QS_CERTIFICATIONS_FILE = path.join(DATA_DIR, 'qs-certifications.json');
const GRN_FILE = path.join(DATA_DIR, 'grn.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const PORT = Number(process.env.PORT || 3001);

// ── TQS Bill Tracker sync ────────────────────────────────────────────────────
const TQS_URL   = process.env.TQS_URL   || 'http://localhost:3000';
const TQS_SYNC_KEY = 'buildpro-tqs-sync-2024';

async function syncToTQS(invoice) {
  if (!invoice) return;
  try {
    await fetch(`${TQS_URL}/api/sync/procurement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': TQS_SYNC_KEY },
      body: JSON.stringify(invoice)
    });
    console.log(`[TQS Sync] Invoice ${invoice.id} pushed to Bill Tracker`);
  } catch (e) {
    console.log(`[TQS Sync] Could not reach TQS Bill Tracker: ${e.message}`);
  }
}

async function syncGRNToTQS(grn, po) {
  if (!grn || !po) return;
  try {
    const payload = { ...grn, poTotal: po.total, poQty: po.qty };
    await fetch(`${TQS_URL}/api/sync/procurement-grn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-key': TQS_SYNC_KEY },
      body: JSON.stringify(payload)
    });
    console.log(`[TQS Sync] GRN ${grn.id} pushed to Store Inventory`);
  } catch (e) {
    console.log(`[TQS Sync] Could not reach TQS Store Inventory: ${e.message}`);
  }
}

// ── Password hashing (Node built-in crypto, no deps needed) ──────────────────
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(plain, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [, salt, hash] = parts;
  try {
    const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ── Server-side session store (persisted to disk) ────────────────────────────
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Load existing sessions from disk so restarts don't invalidate tokens
let _sessionMap;
try {
  const _raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
  _sessionMap = new Map(JSON.parse(_raw));
} catch {
  _sessionMap = new Map();
}
// Prune any already-expired sessions on startup
for (const [_tok, _sess] of _sessionMap) {
  if (Date.now() > _sess.expiresAt) _sessionMap.delete(_tok);
}
const sessions = _sessionMap;

function persistSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([...sessions.entries()], null, 2));
  } catch (e) {
    console.error('[Session] Failed to persist sessions:', e.message);
  }
}

function createSessionToken(userId, role) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, role, expiresAt: Date.now() + SESSION_TTL_MS });
  persistSessions();
  return token;
}

function lookupSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    persistSessions();
    return null;
  }
  return session;
}

function authenticate(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return lookupSession(authHeader.slice(7));
}

// ── Migrate plain-text passwords to hashed on first run ──────────────────────
async function migratePasswords() {
  const users = await readJsonFile(USERS_FILE);
  let changed = false;
  for (const user of users) {
    if (user.password && !user.password.startsWith('scrypt$')) {
      user.password = hashPassword(user.password);
      changed = true;
    }
  }
  if (changed) await writeJsonFile(USERS_FILE, users);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => sendJson(res, 500, { success: false, error: 'Failed to read file' }));
  res.writeHead(200, { 'Content-Type': mime });
  stream.pipe(res);
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(INDENTS_FILE);
  } catch {
    await fsp.writeFile(INDENTS_FILE, JSON.stringify([], null, 2));
  }

  const seedFiles = [
    {
      file: USERS_FILE,
      data: [
        {
          id: 'USR-001',
          name: 'Administrator',
          email: 'admin@company.local',
          password: 'ChangeMe123!',
          role: 'ADMIN',
          created_at: '2026-04-04T00:00:00.000Z'
        }
      ]
    },
    {
      file: PROJECTS_FILE,
      data: []
    },
    {
      file: VENDORS_FILE,
      data: []
    },
    {
      file: QUOTATIONS_FILE,
      data: []
    },
    {
      file: QS_CERTIFICATIONS_FILE,
      data: []
    },
    { file: POS_FILE, data: [] },
    { file: INVOICES_FILE, data: [] },
    { file: GRN_FILE, data: [] },
    { file: SETTINGS_FILE, data: {} }
  ];

  for (const seedFile of seedFiles) {
    try {
      await fsp.access(seedFile.file);
    } catch {
      await fsp.writeFile(seedFile.file, JSON.stringify(seedFile.data, null, 2));
    }
  }
}

async function readIndents() {
  const raw = await fsp.readFile(INDENTS_FILE, 'utf8');
  return JSON.parse(raw);
}

async function readJsonFile(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeIndents(indents) {
  await fsp.writeFile(INDENTS_FILE, JSON.stringify(indents, null, 2));
}

async function writeJsonFile(filePath, data) {
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function formatTimestamp(date = new Date()) {
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

function nextIndentId(indents) {
  const maxId = indents.reduce((max, row) => {
    const num = Number(String(row.id || '').replace(/\D/g, ''));
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
  return `IND-${String(maxId + 1).padStart(3, '0')}`;
}

function validateIndent(payload) {
  const required = ['material', 'category', 'qty', 'unit', 'date', 'raisedBy', 'priority', 'project'];
  const missing = required.filter(key => !payload[key] && payload[key] !== 0);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!['High', 'Medium', 'Low'].includes(payload.priority)) return 'Invalid priority';
  if (!Number.isFinite(Number(payload.qty)) || Number(payload.qty) <= 0) return 'Quantity must be a positive number';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.date))) return 'Date must be in YYYY-MM-DD format';
  return null;
}

function nextId(prefix, rows) {
  const maxId = rows.reduce((max, row) => {
    const num = Number(String(row.id || '').replace(/\D/g, ''));
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
  return `${prefix}-${String(maxId + 1).padStart(3, '0')}`;
}

function validateQuotation(payload) {
  const required = ['indentId', 'vendorId', 'vendorName', 'unitRate', 'gstPercent', 'deliveryDays', 'paymentTerms'];
  const missing = required.filter(key => !payload[key] && payload[key] !== 0);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!Number.isFinite(Number(payload.unitRate)) || Number(payload.unitRate) <= 0) return 'Unit rate must be a positive number';
  if (!Number.isFinite(Number(payload.gstPercent)) || Number(payload.gstPercent) < 0) return 'GST percent must be zero or more';
  if (!Number.isFinite(Number(payload.deliveryDays)) || Number(payload.deliveryDays) < 0) return 'Delivery days must be zero or more';
  return null;
}

function validateGrn(payload) {
  const required = ['poId', 'vendorName', 'material', 'receivedQty', 'unit'];
  const missing = required.filter(key => !payload[key] && payload[key] !== 0);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!Number.isFinite(Number(payload.receivedQty)) || Number(payload.receivedQty) < 0) return 'Received quantity must be zero or more';
  return null;
}

function validateInvoice(payload) {
  const required = ['vendorName', 'material', 'amount'];
  const missing = required.filter(key => !payload[key] && payload[key] !== 0);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) return 'Invoice amount must be a positive number';
  return null;
}

function validateQsCertification(payload) {
  const required = ['grnId', 'vendorName', 'material', 'certifiedQty', 'unit'];
  const missing = required.filter(key => !payload[key] && payload[key] !== 0);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!Number.isFinite(Number(payload.certifiedQty)) || Number(payload.certifiedQty) < 0) return 'Certified quantity must be zero or more';
  if (!Number.isFinite(Number(payload.unitRate)) || Number(payload.unitRate) < 0) return 'Unit rate must be zero or more';
  return null;
}

function notFoundApi(res) {
  sendJson(res, 404, { success: false, error: 'API route not found' });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { success: true, data: { ok: true, service: 'procurement-api' } });
  }

  // Proxy TQS stock inventory so the browser doesn't need a direct cross-origin call
  if (req.method === 'GET' && url.pathname === '/api/tqs/stock-items') {
    try {
      const tqsRes = await fetch(`${TQS_URL}/api/stock-items`);
      const json = await tqsRes.json();
      return sendJson(res, 200, { success: true, data: json });
    } catch (e) {
      return sendJson(res, 502, { success: false, error: 'TQS inventory unavailable' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const payload = await parseBody(req);
    const users = await readJsonFile(USERS_FILE);
    const email = String(payload.email || '').trim().toLowerCase();
    const user = users.find(item => item.email.toLowerCase() === email);
    if (!user || !verifyPassword(String(payload.password || ''), user.password)) {
      return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
    }
    const token = createSessionToken(user.id, user.role);
    const projectList = await readJsonFile(PROJECTS_FILE);
    const project = projectList[0]?.name || 'Active Project';
    return sendJson(res, 200, {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
        project,
        token
      }
    });
  }

  // ── All routes below require a valid session token ───────────────────────
  const session = authenticate(req);
  if (!session) {
    return sendJson(res, 401, { success: false, error: 'Authentication required' });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/users') {
    const users = await readJsonFile(USERS_FILE);
    return sendJson(res, 200, {
      success: true,
      data: users.map(({ password, ...user }) => user)
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    if (session.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, error: 'Admin access required' });
    }
    const payload = await parseBody(req);
    const users = await readJsonFile(USERS_FILE);
    const email = String(payload.email || '').trim().toLowerCase();
    if (!payload.name || !email || !payload.password || !payload.role) {
      return sendJson(res, 400, { success: false, error: 'Name, email, password and role are required' });
    }
    if (users.some(user => user.email.toLowerCase() === email)) {
      return sendJson(res, 400, { success: false, error: 'Email already exists' });
    }
    const user = {
      id: nextId('USR', users),
      name: String(payload.name).trim(),
      email,
      password: hashPassword(String(payload.password)),
      role: String(payload.role).trim(),
      created_at: new Date().toISOString()
    };
    users.push(user);
    await writeJsonFile(USERS_FILE, users);
    const { password, ...safeUser } = user;
    return sendJson(res, 201, { success: true, data: safeUser });
  }

  if (req.method === 'PATCH' && url.pathname === '/api/auth/change-password') {
    const payload = await parseBody(req);
    const currentPw = String(payload.currentPassword || '').trim();
    const newPw = String(payload.newPassword || '').trim();
    if (!currentPw || !newPw) return sendJson(res, 400, { success: false, error: 'currentPassword and newPassword are required' });
    if (newPw.length < 8) return sendJson(res, 400, { success: false, error: 'New password must be at least 8 characters' });
    const users = await readJsonFile(USERS_FILE);
    const user = users.find(item => item.id === session.userId);
    if (!user) return sendJson(res, 404, { success: false, error: 'User not found' });
    if (!verifyPassword(currentPw, user.password)) return sendJson(res, 401, { success: false, error: 'Current password is incorrect' });
    user.password = hashPassword(newPw);
    await writeJsonFile(USERS_FILE, users);
    return sendJson(res, 200, { success: true, data: { updated: true } });
  }

  const userMatch = url.pathname.match(/^\/api\/auth\/users\/([^/]+)$/);
  if (req.method === 'PATCH' && userMatch) {
    if (session.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, error: 'Admin access required' });
    }
    const id = decodeURIComponent(userMatch[1]);
    const payload = await parseBody(req);
    const users = await readJsonFile(USERS_FILE);
    const user = users.find(item => item.id === id);
    if (!user) {
      return sendJson(res, 404, { success: false, error: 'User not found' });
    }
    if (payload.name) user.name = String(payload.name).trim();
    if (payload.email) user.email = String(payload.email).trim().toLowerCase();
    if (payload.role) user.role = String(payload.role).trim();
    if (payload.password) user.password = hashPassword(String(payload.password));
    await writeJsonFile(USERS_FILE, users);
    const { password, ...safeUser } = user;
    return sendJson(res, 200, { success: true, data: safeUser });
  }

  if (req.method === 'DELETE' && userMatch) {
    if (session.role !== 'ADMIN' && session.role !== 'DIRECTOR') {
      return sendJson(res, 403, { success: false, error: 'Admin access required' });
    }
    const id = decodeURIComponent(userMatch[1]);
    if (id === session.id || id === session.userId) {
      return sendJson(res, 400, { success: false, error: 'Cannot delete your own account' });
    }
    const users = await readJsonFile(USERS_FILE);
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) {
      return sendJson(res, 404, { success: false, error: 'User not found' });
    }
    users.splice(idx, 1);
    await writeJsonFile(USERS_FILE, users);
    return sendJson(res, 200, { success: true, data: { deleted: true } });
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    const projects = await readJsonFile(PROJECTS_FILE);
    return sendJson(res, 200, { success: true, data: projects });
  }

  if (req.method === 'POST' && url.pathname === '/api/projects') {
    const payload = await parseBody(req);
    if (!payload.name) {
      return sendJson(res, 400, { success: false, error: 'Project name is required' });
    }
    const projects = await readJsonFile(PROJECTS_FILE);
    const project = {
      id: nextId('PRJ', projects),
      name: String(payload.name).trim(),
      location: String(payload.location || '').trim(),
      budget: Number(payload.budget || 0),
      created_at: new Date().toISOString()
    };
    projects.push(project);
    await writeJsonFile(PROJECTS_FILE, projects);
    return sendJson(res, 201, { success: true, data: project });
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (req.method === 'PATCH' && projectMatch) {
    const id = decodeURIComponent(projectMatch[1]);
    const payload = await parseBody(req);
    const projects = await readJsonFile(PROJECTS_FILE);
    const project = projects.find(item => item.id === id);
    if (!project) {
      return sendJson(res, 404, { success: false, error: 'Project not found' });
    }
    project.name = String(payload.name || project.name).trim();
    project.location = String(payload.location || project.location || '').trim();
    project.budget = Number(payload.budget ?? project.budget ?? 0);
    await writeJsonFile(PROJECTS_FILE, projects);
    return sendJson(res, 200, { success: true, data: project });
  }

  if (req.method === 'POST' && url.pathname === '/api/vendors') {
    const payload = await parseBody(req);
    if (!payload.name || !payload.vendor_type) {
      return sendJson(res, 400, { success: false, error: 'Name and vendor_type are required' });
    }
    const vendors = await readJsonFile(VENDORS_FILE);
    const vendor = {
      id: nextId('VND', vendors),
      name: String(payload.name).trim(),
      trade_name: String(payload.trade_name || payload.name).trim(),
      vendor_type: String(payload.vendor_type).trim(),
      contact_person: String(payload.contact_person || '').trim(),
      phone: String(payload.phone || '').trim(),
      email: String(payload.email || '').trim(),
      address: String(payload.address || '').trim(),
      city: String(payload.city || '').trim(),
      state: String(payload.state || '').trim(),
      pincode: String(payload.pincode || '').trim(),
      gstin: String(payload.gstin || '').trim(),
      pan: String(payload.pan || '').trim(),
      trade_license: String(payload.trade_license || '').trim(),
      msme_reg: String(payload.msme_reg || '').trim(),
      bank_name: String(payload.bank_name || '').trim(),
      bank_account: String(payload.bank_account || '').trim(),
      bank_ifsc: String(payload.bank_ifsc || '').trim(),
      bank_branch: String(payload.bank_branch || '').trim(),
      notes: String(payload.notes || '').trim(),
      created_at: new Date().toISOString()
    };
    vendors.push(vendor);
    await writeJsonFile(VENDORS_FILE, vendors);
    return sendJson(res, 201, { success: true, data: vendor });
  }

  const vendorMatch = url.pathname.match(/^\/api\/vendors\/([^/]+)$/);

  if (req.method === 'PATCH' && vendorMatch) {
    const id = decodeURIComponent(vendorMatch[1]);
    const payload = await parseBody(req);
    const vendors = await readJsonFile(VENDORS_FILE);
    const vendor = vendors.find(item => item.id === id);
    if (!vendor) return sendJson(res, 404, { success: false, error: 'Vendor not found' });
    const fields = ['name','trade_name','vendor_type','contact_person','phone','email','address','city','state','pincode','gstin','pan','trade_license','msme_reg','bank_name','bank_account','bank_ifsc','bank_branch','notes'];
    for (const field of fields) {
      if (payload[field] !== undefined) vendor[field] = String(payload[field]).trim();
    }
    vendor.updated_at = new Date().toISOString();
    await writeJsonFile(VENDORS_FILE, vendors);
    return sendJson(res, 200, { success: true, data: vendor });
  }

  if (req.method === 'DELETE' && vendorMatch) {
    const id = decodeURIComponent(vendorMatch[1]);
    const [vendors, quotations, pos] = await Promise.all([
      readJsonFile(VENDORS_FILE),
      readJsonFile(QUOTATIONS_FILE),
      readJsonFile(POS_FILE)
    ]);
    if (!vendors.find(item => item.id === id)) {
      return sendJson(res, 404, { success: false, error: 'Vendor not found' });
    }
    const inUse = quotations.some(q => q.vendorId === id) || pos.some(p => p.vendorId === id);
    if (inUse) {
      return sendJson(res, 400, { success: false, error: 'Vendor is referenced in existing quotations or POs and cannot be deleted' });
    }
    const updated = vendors.filter(item => item.id !== id);
    await writeJsonFile(VENDORS_FILE, updated);
    return sendJson(res, 200, { success: true, data: { deleted: id } });
  }

  const listEndpoints = {
    '/api/vendors': VENDORS_FILE,
    '/api/quotations': QUOTATIONS_FILE,
    '/api/pos': POS_FILE,
    '/api/invoices': INVOICES_FILE,
    '/api/qs-certifications': QS_CERTIFICATIONS_FILE,
    '/api/grn': GRN_FILE
  };
  if (req.method === 'GET' && url.pathname === '/api/settings') {
    const settings = await readJsonFile(SETTINGS_FILE);
    return sendJson(res, 200, { success: true, data: settings });
  }

  if (req.method === 'PATCH' && url.pathname === '/api/settings') {
    const payload = await parseBody(req);
    const settings = await readJsonFile(SETTINGS_FILE);
    const updated = { ...settings, ...payload };
    await writeJsonFile(SETTINGS_FILE, updated);
    return sendJson(res, 200, { success: true, data: updated });
  }

  // Role permissions — stored inside settings.json under key "rolePermissions"
  if (req.method === 'GET' && url.pathname === '/api/permissions') {
    const settings = await readJsonFile(SETTINGS_FILE);
    return sendJson(res, 200, { success: true, data: settings.rolePermissions || {} });
  }

  if (req.method === 'PUT' && url.pathname === '/api/permissions') {
    if (session.role !== 'ADMIN' && session.role !== 'DIRECTOR') {
      return sendJson(res, 403, { success: false, error: 'Admin access required' });
    }
    const payload = await parseBody(req);
    const settings = await readJsonFile(SETTINGS_FILE);
    settings.rolePermissions = payload;
    await writeJsonFile(SETTINGS_FILE, settings);
    return sendJson(res, 200, { success: true, data: settings.rolePermissions });
  }

  const indentNoteMatch = url.pathname.match(/^\/api\/indents\/([^/]+)\/note$/);
  if (req.method === 'POST' && indentNoteMatch) {
    const id = decodeURIComponent(indentNoteMatch[1]);
    const payload = await parseBody(req);
    const indents = await readIndents();
    const row = indents.find(item => item.id === id);
    if (!row) return sendJson(res, 404, { success: false, error: 'Indent not found' });
    if (!row.infoLog) row.infoLog = [];
    row.infoLog.unshift({
      requestedFields: Array.isArray(payload.requestedFields) ? payload.requestedFields : [],
      message: String(payload.message || '').trim(),
      time: formatTimestamp(),
      by: session.name || session.role
    });
    await writeIndents(indents);
    return sendJson(res, 200, { success: true, data: row });
  }

  if (req.method === 'GET' && listEndpoints[url.pathname]) {
    const data = await readJsonFile(listEndpoints[url.pathname]);
    return sendJson(res, 200, { success: true, data });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/reset') {
    if (session.role !== 'ADMIN') {
      return sendJson(res, 403, { success: false, error: 'Admin access required' });
    }
    await writeIndents([]);
    await writeJsonFile(QUOTATIONS_FILE, []);
    await writeJsonFile(POS_FILE, []);
    await writeJsonFile(INVOICES_FILE, []);
    await writeJsonFile(QS_CERTIFICATIONS_FILE, []);
    await writeJsonFile(GRN_FILE, []);
    return sendJson(res, 200, { success: true, data: { ok: true } });
  }

  if (req.method === 'GET' && url.pathname === '/api/indents') {
    const indents = await readIndents();
    const sorted = [...indents].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    return sendJson(res, 200, { success: true, data: sorted });
  }

  if (req.method === 'POST' && url.pathname === '/api/indents') {
    const payload = await parseBody(req);
    const error = validateIndent(payload);
    if (error) return sendJson(res, 400, { success: false, error });

    const indents = await readIndents();
    const now = formatTimestamp();
    const record = {
      id: nextIndentId(indents),
      material: String(payload.material).trim(),
      category: String(payload.category).trim(),
      qty: Number(payload.qty),
      unit: String(payload.unit).trim(),
      date: String(payload.date).trim(),
      raisedBy: String(payload.raisedBy).trim(),
      priority: String(payload.priority).trim(),
      status: payload.draft === true ? 'Draft' : 'Pending',
      project: String(payload.project).trim(),
      notes: String(payload.notes || '').trim(),
      submitted: now,
    };
    indents.unshift(record);
    await writeIndents(indents);
    return sendJson(res, 201, { success: true, data: record });
  }

  const indentDeleteMatch = url.pathname.match(/^\/api\/indents\/([^/]+)$/);
  if (req.method === 'DELETE' && indentDeleteMatch) {
    const id = decodeURIComponent(indentDeleteMatch[1]);
    const indents = await readIndents();
    const idx = indents.findIndex(item => item.id === id);
    if (idx === -1) return sendJson(res, 404, { success: false, error: 'Indent not found' });
    const [removed] = indents.splice(idx, 1);
    await writeIndents(indents);
    return sendJson(res, 200, { success: true, data: removed });
  }

  const quotationDeleteMatch = url.pathname.match(/^\/api\/quotations\/([^/]+)$/);
  if (req.method === 'DELETE' && quotationDeleteMatch) {
    const id = decodeURIComponent(quotationDeleteMatch[1]);
    const quotations = await readJsonFile(QUOTATIONS_FILE);
    const idx = quotations.findIndex(item => item.id === id);
    if (idx === -1) return sendJson(res, 404, { success: false, error: 'Quotation not found' });
    const [removed] = quotations.splice(idx, 1);
    await writeJsonFile(QUOTATIONS_FILE, quotations);
    return sendJson(res, 200, { success: true, data: removed });
  }

  if (req.method === 'POST' && url.pathname === '/api/quotations') {
    const payload = await parseBody(req);
    const error = validateQuotation(payload);
    if (error) return sendJson(res, 400, { success: false, error });

    const quotations = await readJsonFile(QUOTATIONS_FILE);
    const indents = await readIndents();
    const indent = indents.find(item => item.id === payload.indentId);
    if (!indent) return sendJson(res, 404, { success: false, error: 'Indent not found' });

    const record = {
      id: nextId('QT', quotations),
      indentId: String(payload.indentId).trim(),
      vendorId: String(payload.vendorId).trim(),
      vendorName: String(payload.vendorName).trim(),
      unitRate: Number(payload.unitRate),
      gstPercent: Number(payload.gstPercent),
      deliveryDays: Number(payload.deliveryDays),
      paymentTerms: String(payload.paymentTerms).trim(),
      notes: String(payload.notes || '').trim(),
      submittedAt: new Date().toISOString(),
      selected: false
    };
    quotations.push(record);
    await writeJsonFile(QUOTATIONS_FILE, quotations);
    return sendJson(res, 201, { success: true, data: record });
  }

  const quoteSelectMatch = url.pathname.match(/^\/api\/quotations\/([^/]+)\/select$/);
  if (req.method === 'POST' && quoteSelectMatch) {
    const quotationId = decodeURIComponent(quoteSelectMatch[1]);
    const quotations = await readJsonFile(QUOTATIONS_FILE);
    const quote = quotations.find(item => item.id === quotationId);
    if (!quote) return sendJson(res, 404, { success: false, error: 'Quotation not found' });

    quotations.forEach(item => {
      if (item.indentId === quote.indentId) item.selected = item.id === quotationId;
    });
    await writeJsonFile(QUOTATIONS_FILE, quotations);

    const indents = await readIndents();
    const indent = indents.find(item => item.id === quote.indentId);
    if (indent) {
      indent.status = 'PO Raised';
      indent.poOn = formatTimestamp();
      indent.selectedVendor = quote.vendorName;
      await writeIndents(indents);
    }

    const pos = await readJsonFile(POS_FILE);
    const existingPo = pos.find(item => item.sourceQuotationId === quote.id);
    let po = existingPo;
    if (!existingPo) {
      const subtotal = Number(indent?.qty || 0) * Number(quote.unitRate);
      const total = subtotal + subtotal * (Number(quote.gstPercent) / 100);
      po = {
        id: nextId('PO', pos),
        sourceQuotationId: quote.id,
        indentId: quote.indentId,
        vendorId: quote.vendorId,
        vendorName: quote.vendorName,
        material: indent?.material || '',
        qty: Number(indent?.qty || 0),
        unit: indent?.unit || '',
        total,
        status: 'Issued',
        created_at: new Date().toISOString()
      };
      pos.push(po);
      await writeJsonFile(POS_FILE, pos);
    }

    return sendJson(res, 200, { success: true, data: { quotationId: quote.id, po } });
  }

  if (req.method === 'POST' && url.pathname === '/api/pos') {
    const payload = await parseBody(req);
    if (!payload.vendorName || !payload.material || !payload.qty || !payload.unit || !payload.total) {
      return sendJson(res, 400, { success: false, error: 'vendorName, material, qty, unit and total are required' });
    }
    const pos = await readJsonFile(POS_FILE);
    const po = {
      id: nextId('PO', pos),
      sourceQuotationId: String(payload.sourceQuotationId || '').trim(),
      indentId: String(payload.indentId || '').trim(),
      vendorId: String(payload.vendorId || '').trim(),
      vendorName: String(payload.vendorName).trim(),
      material: String(payload.material).trim(),
      qty: Number(payload.qty),
      unit: String(payload.unit).trim(),
      total: Number(payload.total),
      status: String(payload.status || 'Issued').trim(),
      created_at: new Date().toISOString()
    };
    pos.push(po);
    await writeJsonFile(POS_FILE, pos);
    return sendJson(res, 201, { success: true, data: po });
  }

  const poDeleteMatch = url.pathname.match(/^\/api\/pos\/([^/]+)$/);
  if (req.method === 'DELETE' && poDeleteMatch) {
    const id = decodeURIComponent(poDeleteMatch[1]);
    const pos = await readJsonFile(POS_FILE);
    const idx = pos.findIndex(item => item.id === id);
    if (idx === -1) return sendJson(res, 404, { success: false, error: 'PO not found' });
    const [removed] = pos.splice(idx, 1);
    await writeJsonFile(POS_FILE, pos);
    return sendJson(res, 200, { success: true, data: removed });
  }

  if (req.method === 'POST' && url.pathname === '/api/grn') {
    const payload = await parseBody(req);
    const error = validateGrn(payload);
    if (error) return sendJson(res, 400, { success: false, error });

    const grnRows = await readJsonFile(GRN_FILE);
    const pos = await readJsonFile(POS_FILE);
    const po = pos.find(item => item.id === payload.poId);
    if (!po) return sendJson(res, 404, { success: false, error: 'PO not found' });

    const receivedQty = Number(payload.receivedQty);
    const orderedQty = Number(po.qty || 0);
    const status = receivedQty >= orderedQty ? 'Received' : 'Partially Received';
    const record = {
      id: nextId('GRN', grnRows),
      poId: String(payload.poId).trim(),
      indentId: String(po.indentId || '').trim(),
      vendorName: String(payload.vendorName).trim(),
      material: String(payload.material).trim(),
      receivedQty,
      unit: String(payload.unit).trim(),
      qualityStatus: String(payload.qualityStatus || 'Accepted').trim(),
      notes: String(payload.notes || '').trim(),
      status,
      created_at: new Date().toISOString()
    };
    grnRows.push(record);
    await writeJsonFile(GRN_FILE, grnRows);

    po.status = status;
    po.received_at = new Date().toISOString();
    po.updated_at = new Date().toISOString();
    await writeJsonFile(POS_FILE, pos);
    
    syncGRNToTQS(record, po);

    return sendJson(res, 201, { success: true, data: record });
  }

  const grnDeleteMatch = url.pathname.match(/^\/api\/grn\/([^/]+)$/);
  if (req.method === 'DELETE' && grnDeleteMatch) {
    const id = decodeURIComponent(grnDeleteMatch[1]);
    const grnRows = await readJsonFile(GRN_FILE);
    const idx = grnRows.findIndex(item => item.id === id);
    if (idx === -1) return sendJson(res, 404, { success: false, error: 'GRN not found' });
    const [removed] = grnRows.splice(idx, 1);
    await writeJsonFile(GRN_FILE, grnRows);
    return sendJson(res, 200, { success: true, data: removed });
  }

  const invoiceDeleteMatch = url.pathname.match(/^\/api\/invoices\/([^/]+)$/);
  if (req.method === 'DELETE' && invoiceDeleteMatch) {
    const id = decodeURIComponent(invoiceDeleteMatch[1]);
    const invoices = await readJsonFile(INVOICES_FILE);
    const idx = invoices.findIndex(item => item.id === id);
    if (idx === -1) return sendJson(res, 404, { success: false, error: 'Invoice not found' });
    const [removed] = invoices.splice(idx, 1);
    await writeJsonFile(INVOICES_FILE, invoices);
    return sendJson(res, 200, { success: true, data: removed });
  }

  if (req.method === 'POST' && url.pathname === '/api/invoices') {
    const payload = await parseBody(req);
    const error = validateInvoice(payload);
    if (error) return sendJson(res, 400, { success: false, error });

    const invoices = await readJsonFile(INVOICES_FILE);
    const record = {
      id: nextId('INV', invoices),
      poId: String(payload.poId || '').trim(),
      grnId: String(payload.grnId || '').trim(),
      vendorName: String(payload.vendorName).trim(),
      material: String(payload.material).trim(),
      amount: Number(payload.amount),
      status: String(payload.status || 'Pending').trim(),
      notes: String(payload.notes || '').trim(),
      created_at: new Date().toISOString(),
      projectName: String(payload.projectName || '').trim(),
      // Full Bill Entry / TQS fields (forwarded to TQS sync)
      invNumber: String(payload.invNumber || '').trim(),
      invDate: String(payload.invDate || '').trim(),
      invMonth: String(payload.invMonth || '').trim(),
      receivedDate: String(payload.receivedDate || '').trim(),
      poNumber: String(payload.poNumber || payload.poId || '').trim(),
      poDate: String(payload.poDate || '').trim(),
      basicAmount: Number(payload.basicAmount || 0),
      cgstPct: Number(payload.cgstPct || 0),
      cgstAmt: Number(payload.cgstAmt || 0),
      sgstPct: Number(payload.sgstPct || 0),
      sgstAmt: Number(payload.sgstAmt || 0),
      igstPct: Number(payload.igstPct || 0),
      igstAmt: Number(payload.igstAmt || 0),
      gstAmount: Number(payload.gstAmount || 0),
      transportCharges: Number(payload.transportCharges || 0),
      transportGstPct: Number(payload.transportGstPct || 0),
      transportGstAmt: Number(payload.transportGstAmt || 0),
      otherCharges: Number(payload.otherCharges || 0),
      otherChargesDesc: String(payload.otherChargesDesc || '').trim(),
      creditNoteNum: String(payload.creditNoteNum || '').trim(),
      creditNoteVal: Number(payload.creditNoteVal || 0),
      totalAmount: Number(payload.totalAmount || payload.amount || 0),
      trackerType: String(payload.trackerType || 'po').trim(),
      remarks: String(payload.remarks || '').trim()
    };
    invoices.push(record);
    await writeJsonFile(INVOICES_FILE, invoices);
    syncToTQS(record); // fire-and-forget push to TQS Bill Tracker
    return sendJson(res, 201, { success: true, data: record });
  }

  if (req.method === 'POST' && url.pathname === '/api/qs-certifications') {
    const payload = await parseBody(req);
    const error = validateQsCertification(payload);
    if (error) return sendJson(res, 400, { success: false, error });

    const qsRows = await readJsonFile(QS_CERTIFICATIONS_FILE);
    const certifiedQty = Number(payload.certifiedQty);
    const unitRate = Number(payload.unitRate || 0);
    const grossAmount = Number(payload.grossAmount || certifiedQty * unitRate);
    const deductions = Number(payload.deductions || 0);
    const retentionPct = Number(payload.retentionPct || 0);
    const retentionAmount = Number(payload.retentionAmount || Math.max((grossAmount - deductions) * retentionPct / 100, 0));
    const gstPct = Number(payload.gstPct || 0);
    const gstAmount = Number(payload.gstAmount || Math.max((grossAmount - deductions - retentionAmount) * gstPct / 100, 0));
    const netAmount = Number(payload.netAmount || (grossAmount - deductions - retentionAmount + gstAmount));
    const record = {
      id: nextId('QSC', qsRows),
      poId: String(payload.poId || '').trim(),
      grnId: String(payload.grnId).trim(),
      vendorName: String(payload.vendorName).trim(),
      material: String(payload.material).trim(),
      certifiedQty,
      unit: String(payload.unit).trim(),
      unitRate,
      grossAmount,
      deductions,
      deductionReason: String(payload.deductionReason || '').trim(),
      retentionPct,
      retentionAmount,
      gstPct,
      gstAmount,
      netAmount,
      certifiedAmount: netAmount,
      qualityRemarks: String(payload.qualityRemarks || '').trim(),
      status: String(payload.status || 'Submitted').trim(),
      notes: String(payload.notes || '').trim(),
      created_at: new Date().toISOString()
    };
    qsRows.push(record);
    await writeJsonFile(QS_CERTIFICATIONS_FILE, qsRows);
    return sendJson(res, 201, { success: true, data: record });
  }

  const qsDeleteMatch = url.pathname.match(/^\/api\/qs-certifications\/([^/]+)$/);
  if (req.method === 'DELETE' && qsDeleteMatch) {
    const id = decodeURIComponent(qsDeleteMatch[1]);
    const qsRows = await readJsonFile(QS_CERTIFICATIONS_FILE);
    const idx = qsRows.findIndex(item => item.id === id);
    if (idx === -1) return sendJson(res, 404, { success: false, error: 'QS certification not found' });
    const [removed] = qsRows.splice(idx, 1);
    await writeJsonFile(QS_CERTIFICATIONS_FILE, qsRows);
    return sendJson(res, 200, { success: true, data: removed });
  }

  const qsStatusMatch = url.pathname.match(/^\/api\/qs-certifications\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && qsStatusMatch) {
    const id = decodeURIComponent(qsStatusMatch[1]);
    const payload = await parseBody(req);
    const allowed = ['Draft', 'Submitted', 'Certified', 'Rework Required'];
    if (!allowed.includes(payload.status)) {
      return sendJson(res, 400, { success: false, error: 'Invalid QS certification status' });
    }

    const qsRows = await readJsonFile(QS_CERTIFICATIONS_FILE);
    const cert = qsRows.find(item => item.id === id);
    if (!cert) return sendJson(res, 404, { success: false, error: 'QS certification not found' });

    cert.status = payload.status;
    cert.updated_at = new Date().toISOString();
    if (payload.status === 'Certified') cert.certified_at = new Date().toISOString();
    if (payload.status === 'Rework Required') cert.rework_at = new Date().toISOString();
    await writeJsonFile(QS_CERTIFICATIONS_FILE, qsRows);
    return sendJson(res, 200, { success: true, data: cert });
  }

  const invoiceStatusMatch = url.pathname.match(/^\/api\/invoices\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && invoiceStatusMatch) {
    const id = decodeURIComponent(invoiceStatusMatch[1]);
    const payload = await parseBody(req);
    const allowed = ['Pending', 'Approved', 'Paid', 'On Hold'];
    if (!allowed.includes(payload.status)) {
      return sendJson(res, 400, { success: false, error: 'Invalid invoice status' });
    }

    const invoices = await readJsonFile(INVOICES_FILE);
    const invoice = invoices.find(item => item.id === id);
    if (!invoice) return sendJson(res, 404, { success: false, error: 'Invoice not found' });

    invoice.status = payload.status;
    invoice.updated_at = new Date().toISOString();
    if (payload.status === 'Approved') invoice.approved_at = new Date().toISOString();
    if (payload.status === 'Paid') invoice.paid_at = new Date().toISOString();
    if (payload.status === 'On Hold') invoice.hold_at = new Date().toISOString();
    await writeJsonFile(INVOICES_FILE, invoices);
    syncToTQS(invoice); // sync updated status to TQS Bill Tracker
    return sendJson(res, 200, { success: true, data: invoice });
  }

  const poEditMatch = url.pathname.match(/^\/api\/pos\/([^/]+)$/);
  if (req.method === 'PATCH' && poEditMatch) {
    const id = decodeURIComponent(poEditMatch[1]);
    const payload = await parseBody(req);
    const pos = await readJsonFile(POS_FILE);
    const po = pos.find(item => item.id === id);
    if (!po) return sendJson(res, 404, { success: false, error: 'PO not found' });
    const editableFields = ['vendorName', 'material', 'qty', 'unit', 'total', 'notes', 'deliveryDays', 'paymentTerms'];
    for (const field of editableFields) {
      if (payload[field] !== undefined) {
        po[field] = ['qty', 'total', 'deliveryDays'].includes(field) ? Number(payload[field]) : String(payload[field]).trim();
      }
    }
    po.updated_at = new Date().toISOString();
    await writeJsonFile(POS_FILE, pos);
    return sendJson(res, 200, { success: true, data: po });
  }

  const poStatusMatch = url.pathname.match(/^\/api\/pos\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && poStatusMatch) {
    const id = decodeURIComponent(poStatusMatch[1]);
    const payload = await parseBody(req);
    const allowed = ['Issued', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
    if (!allowed.includes(payload.status)) {
      return sendJson(res, 400, { success: false, error: 'Invalid PO status' });
    }

    const pos = await readJsonFile(POS_FILE);
    const po = pos.find(item => item.id === id);
    if (!po) return sendJson(res, 404, { success: false, error: 'PO not found' });

    po.status = payload.status;
    po.updated_at = new Date().toISOString();
    if (payload.status === 'Sent') po.sent_at = new Date().toISOString();
    if (payload.status === 'Received' || payload.status === 'Partially Received') po.received_at = new Date().toISOString();
    if (payload.status === 'Cancelled') po.cancelled_at = new Date().toISOString();
    await writeJsonFile(POS_FILE, pos);
    return sendJson(res, 200, { success: true, data: po });
  }

  const statusMatch = url.pathname.match(/^\/api\/indents\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && statusMatch) {
    const id = decodeURIComponent(statusMatch[1]);
    const payload = await parseBody(req);
    const allowed = ['Pending', 'Approved', 'Rejected', 'PO Raised', 'Escalated'];
    if (!allowed.includes(payload.status)) {
      return sendJson(res, 400, { success: false, error: 'Invalid status transition' });
    }

    const indents = await readIndents();
    const row = indents.find(item => item.id === id);
    if (!row) return sendJson(res, 404, { success: false, error: 'Indent not found' });

    const ts = formatTimestamp();
    const actor = String(payload.actor || 'Administrator').trim() || 'Administrator';

    row.status = payload.status;
    if (payload.status === 'Approved') {
      const approvedQty = Number(payload.approvedQty);
      const originalRowQty = Number(row.qty);
      if (approvedQty > 0 && approvedQty < originalRowQty) {
        const remainingQty = originalRowQty - approvedQty;
        const newIndent = {
          ...row,
          id: nextIndentId(indents),
          qty: remainingQty,
          status: 'Pending',
          notes: `[Balance from ${row.id}] ${row.notes || ''}`.trim(),
          submitted: ts
        };
        delete newIndent.approvedBy;
        delete newIndent.approvedOn;
        delete newIndent.poOn;
        delete newIndent.rejectedBy;
        delete newIndent.rejectedOn;
        delete newIndent.escalatedBy;
        delete newIndent.escalatedOn;
        
        indents.unshift(newIndent);
        row.originalQty = originalRowQty;
        row.qty = approvedQty;
      }
      row.approvedBy = actor;
      row.approvedOn = ts;
      delete row.rejectedBy;
      delete row.rejectedOn;
      delete row.rejectReason;
    }
    if (payload.status === 'Rejected') {
      row.rejectedBy = actor;
      row.rejectedOn = ts;
      row.rejectReason = String(payload.reason || 'Rejected by purchase manager.').trim();
      delete row.approvedBy;
      delete row.approvedOn;
    }
    if (payload.status === 'Escalated') {
      row.escalatedBy = actor;
      row.escalatedOn = ts;
    }
    if (payload.status === 'PO Raised') {
      row.poOn = ts;
    }

    await writeIndents(indents);
    return sendJson(res, 200, { success: true, data: row });
  }

  return notFoundApi(res);
}

async function resolveStaticPath(urlPath) {
  let reqPath = decodeURIComponent(urlPath);
  if (reqPath === '/') reqPath = '/login.html';
  reqPath = reqPath.replace(/^\/+/, '');

  const directPath = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (directPath.startsWith(PUBLIC_DIR)) {
    try {
      const stat = await fsp.stat(directPath);
      if (stat.isFile()) return directPath;
    } catch {}
  }

  if (!path.extname(reqPath)) {
    const htmlPath = path.normalize(path.join(PUBLIC_DIR, `${reqPath}.html`));
    if (htmlPath.startsWith(PUBLIC_DIR)) {
      try {
        const stat = await fsp.stat(htmlPath);
        if (stat.isFile()) return htmlPath;
      } catch {}
    }
  }

  return null;
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }

    const filePath = await resolveStaticPath(url.pathname);
    if (!filePath) {
      return sendJson(res, 404, { success: false, error: 'File not found' });
    }
    return sendFile(res, filePath);
  } catch (error) {
    return sendJson(res, 500, { success: false, error: error.message || 'Internal server error' });
  }
}

async function start() {
  await ensureDataFiles();
  await migratePasswords();
  const server = http.createServer(requestHandler);
  server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const ip = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
    console.log(`Procurement app running on http://localhost:${PORT}`);
    console.log(`Network access:            http://${ip}:${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
