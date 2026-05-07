// src/routes/vendor.routes.js
const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const vendorRouter = express.Router();

const upload = multer({ dest: 'uploads/' });

vendorRouter.use(authenticate);

// GET / — List all active vendors
// Ensure extra columns exist (added when DQS vendor list was unified)
const ensureVendorCols = async () => {
  const extras = [
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS trade_name    TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pincode       TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS trade_license TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS msme_reg      TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_branch   TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes         TEXT DEFAULT ''`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website_url   TEXT DEFAULT ''`,
  ];
  for (const sql of extras) await query(sql).catch(() => {});
};
ensureVendorCols();

vendorRouter.get('/', async (req, res) => {
  try {
    const { search, vendor_type } = req.query;
    const params = [req.user.company_id];
    let i = 2;
    let sql = `SELECT *, COALESCE(trade_name,'') AS trade_name, COALESCE(pincode,'') AS pincode,
      COALESCE(trade_license,'') AS trade_license, COALESCE(msme_reg,'') AS msme_reg,
      COALESCE(bank_branch,'') AS bank_branch, COALESCE(notes,'') AS notes,
      COALESCE(website_url,'') AS website_url
      FROM vendors WHERE company_id = $1 AND is_active = true`;
    if (search) {
      sql += ` AND (name ILIKE $${i} OR gstin ILIKE $${i} OR contact_person ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }
    if (vendor_type) { sql += ` AND vendor_type = $${i++}`; params.push(vendor_type); }
    sql += ' ORDER BY name ASC';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — Create single vendor
vendorRouter.post('/', authorize('admin', 'procurement_manager'), async (req, res) => {
  try {
    const {
      name, gstin, pan, vendor_type, contact_person, phone, email,
      address, city, state, pincode, trade_name, trade_license, msme_reg,
      bank_name, account_number, ifsc_code, bank_branch, notes, website_url, credit_days,
    } = req.body;

    const code = `VEN-${Date.now().toString().slice(-6)}`;

    const result = await query(
      `INSERT INTO vendors (
        company_id, vendor_code, name, trade_name, gstin, pan, vendor_type,
        contact_person, phone, email, address, city, state, pincode,
        trade_license, msme_reg, bank_name, account_number, ifsc_code,
        bank_branch, notes, website_url, credit_days
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      RETURNING *`,
      [
        req.user.company_id, code, name, trade_name||'', gstin||'', pan||'', vendor_type||'',
        contact_person||'', phone||'', email||'', address||'', city||'', state||'', pincode||'',
        trade_license||'', msme_reg||'', bank_name||'', account_number||'', ifsc_code||'',
        bank_branch||'', notes||'', website_url||'', credit_days || 30,
      ]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — Update vendor
vendorRouter.put('/:id', authorize('admin', 'procurement_manager'), async (req, res) => {
  try {
    const fields = req.body;
    const allowed = [
      'name', 'trade_name', 'gstin', 'pan', 'vendor_type', 'contact_person', 'phone',
      'email', 'address', 'city', 'state', 'pincode', 'trade_license', 'msme_reg',
      'bank_name', 'account_number', 'ifsc_code', 'bank_branch', 'notes', 'website_url',
      'credit_days', 'is_active',
    ];
    
    let updates = [];
    let params = [req.params.id];
    let i = 2;

    Object.keys(fields).forEach(key => {
      if (allowed.includes(key)) {
        updates.push(`${key} = $${i++}`);
        params.push(fields[key]);
      }
    });

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

    const sql = `UPDATE vendors SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await query(sql, params);
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — Deactivate vendor
vendorRouter.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await query('UPDATE vendors SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'Vendor deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /import — Bulk import vendors from CSV
vendorRouter.post('/import', authorize('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const fs = require('fs');
    const content = fs.readFileSync(req.file.path, 'utf8');
    const lines = content.split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const results = await withTransaction(async (client) => {
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // CSV parser — handles quoted fields (preserves spaces inside quotes)
        const values = [];
        let cur = '', inQ = false;
        for (let c = 0; c < lines[i].length; c++) {
          const ch = lines[i][c];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        values.push(cur.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
        });

        if (!row.name) continue;

        const code = `VEN-${Date.now().toString().slice(-4)}${i}`;
        await client.query(
          `INSERT INTO vendors (
            company_id, vendor_code, name, vendor_type, gstin, pan, 
            contact_person, phone, email, city, state, website_url, credit_days
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            req.user.company_id, code, row.name, row.type || 'material_supplier', 
            row.gstin, row.pan, row.contact || row.contact_person, 
            row.phone, row.email, row.city, row.state, row.website_url || row.website || '', 
            parseInt(row.credit_days) || 30
          ]
        );
        imported++;
      }
      return imported;
    });

    // Cleanup file
    fs.unlinkSync(req.file.path);
    res.json({ message: `Successfully imported ${results} vendors`, count: results });
  } catch (err) {
    if (req.file) require('fs').unlinkSync(req.file.path);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
});

// GET /vendors/live-check?vendor_id=&material=&url=
vendorRouter.get('/live-check', async (req, res) => {
  try {
    const { vendor_id, material = '', url = '' } = req.query;

    let sourceUrl = String(url || '').trim();
    let vendor = null;
    if (vendor_id) {
      const result = await query(
        `SELECT id, name, website_url, vendor_code FROM vendors WHERE id = $1 AND company_id = $2`,
        [vendor_id, req.user.company_id]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      vendor = result.rows[0];
      sourceUrl = sourceUrl || vendor.website_url || '';
    }

    if (!sourceUrl) {
      return res.status(400).json({ error: 'Provide vendor_id or a website URL' });
    }

    if (!/^https?:\/\//i.test(sourceUrl)) {
      sourceUrl = `https://${sourceUrl}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(sourceUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ConstructERP/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      return res.status(502).json({
        error: `Vendor page returned ${upstream.status}`,
        source_url: sourceUrl,
        vendor: vendor ? { id: vendor.id, name: vendor.name, vendor_code: vendor.vendor_code } : null,
      });
    }

    const html = await upstream.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
    const plain = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const needle = String(material || '').trim().toLowerCase();
    let windowText = plain.slice(0, 1600);
    if (needle) {
      const idx = plain.toLowerCase().indexOf(needle);
      if (idx >= 0) {
        windowText = plain.slice(Math.max(0, idx - 220), Math.min(plain.length, idx + 700));
      }
    }

    const priceMatches = [];
    const patterns = [
      /(?:₹|rs\.?|inr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi,
      /([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)/g,
    ];
    for (const pattern of patterns) {
      for (const match of windowText.matchAll(pattern)) {
        const raw = match[1] || match[0];
        const numeric = parseFloat(String(raw).replace(/,/g, ''));
        if (!Number.isNaN(numeric) && numeric > 0) {
          priceMatches.push(numeric);
        }
      }
      if (priceMatches.length >= 10) break;
    }

    const snippet = windowText.slice(0, 900);
    const suggestedPrice = priceMatches[0] || null;

    res.json({
      data: {
        vendor: vendor ? { id: vendor.id, name: vendor.name, vendor_code: vendor.vendor_code } : null,
        source_url: sourceUrl,
        page_title: title || null,
        material: material || '',
        snippet,
        price_matches: priceMatches.slice(0, 10),
        suggested_price: suggestedPrice,
        fetched_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 500;
    res.status(status).json({ error: err.message });
  }
});

module.exports = vendorRouter;
