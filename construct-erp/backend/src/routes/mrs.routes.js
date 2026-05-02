// src/routes/mrs.routes.js — Material Requisition Slips
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query, withTransaction } = require('../config/database');
const router = express.Router();
// Public Verification Endpoint (No Auth required for QR scanning)
router.get('/public/verify/:id', async (req, res) => {
  try {
    const mrs = await query(
      `SELECT mr.serial_no_formatted, mr.status, mr.created_at, mr.department,
              p.name AS project_name, p.project_code,
              u.name AS raised_by_name, u.signature_url AS raised_by_sig,
              t.name AS verified_tower_name, t.signature_url AS verified_tower_sig,
              t.verified_tower_mgr_at,
              pm.name AS approved_pm_name, pm.signature_url AS approved_pm_sig,
              pm.approved_pm_at,
              spm.name AS approved_srpm_name, spm.signature_url AS approved_srpm_sig,
              spm.approved_sr_pm_at,
              mgmt.name AS approved_mgmt_name, mgmt.signature_url AS approved_mgmt_sig,
              mgmt.approved_mgmt_at,
              md.name AS approved_md_name, md.signature_url AS approved_md_sig,
              md.approved_md_at
       FROM material_requisitions mr
       JOIN projects p ON mr.project_id = p.id
       JOIN users u ON mr.raised_by = u.id
       LEFT JOIN users t ON mr.verified_tower_mgr_by = t.id
       LEFT JOIN users pm ON mr.approved_pm_by = pm.id
       LEFT JOIN users spm ON mr.approved_sr_pm_by = spm.id
       LEFT JOIN users mgmt ON mr.approved_mgmt_by = mgmt.id
       LEFT JOIN users md ON mr.approved_md_by = md.id
       WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!mrs.rows.length) return res.status(404).json({ error: 'MRS not found' });
    
    const items = await query(
      `SELECT material_name, quantity, unit, sort_order FROM mrs_items WHERE mrs_id = $1 ORDER BY sort_order`,
      [req.params.id]
    );
    res.json({ data: { ...mrs.rows[0], items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate);

// Auto-add signature image columns per approval stage
(async () => {
  try {
    const cols = [
      'raised_sig_img', 'tower_sig_img', 'pm_sig_img',
      'srpm_sig_img', 'mgmt_sig_img', 'md_sig_img',
    ];
    for (const col of cols) {
      await query(`ALTER TABLE material_requisitions ADD COLUMN IF NOT EXISTS ${col} TEXT`);
    }
  } catch (e) {
    console.warn('[mrs] sig migration skipped:', e.message);
  }
})();

// GET /stores/mrs
router.get('/', async (req, res) => {
  try {
    const { project_id, status } = req.query;
    let sql = `
      SELECT mr.*, p.name AS project_name,
             u.name AS raised_by_name, a.name AS approved_by_name
      FROM material_requisitions mr
      JOIN projects p ON mr.project_id = p.id
      JOIN users u ON mr.raised_by = u.id
      LEFT JOIN users a ON mr.approved_by = a.id
      WHERE p.company_id = $1`;
    const params = [req.user.company_id];
    let i = 2;
    if (project_id) { sql += ` AND mr.project_id = $${i++}`; params.push(project_id); }
    if (status)     { sql += ` AND mr.status = $${i++}`;     params.push(status); }
    sql += ` ORDER BY mr.created_at DESC`;
    const result = await query(sql, params);

    // Fetch items for each MRS
    const ids = result.rows.map(r => r.id);
    let itemsMap = {};
    if (ids.length) {
      const items = await query(
        `SELECT * FROM mrs_items WHERE mrs_id = ANY($1::uuid[]) ORDER BY sort_order`,
        [ids]
      );
      items.rows.forEach(it => {
        if (!itemsMap[it.mrs_id]) itemsMap[it.mrs_id] = [];
        itemsMap[it.mrs_id].push(it);
      });
    }
    const data = result.rows.map(r => ({ ...r, items: itemsMap[r.id] || [] }));
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /stores/mrs/:id
router.get('/:id', async (req, res) => {
  try {
    const mrs = await query(
      `SELECT mr.*,
              mr.tower_sig_img, mr.pm_sig_img, mr.srpm_sig_img, mr.mgmt_sig_img, mr.md_sig_img,
              p.name AS project_name, p.project_code, p.company_id,
              u.name AS raised_by_name, u.signature_url AS raised_by_sig,
              t.name AS verified_tower_name, t.signature_url AS verified_tower_sig,
              pm.name AS approved_pm_name, pm.signature_url AS approved_pm_sig,
              spm.name AS approved_srpm_name, spm.signature_url AS approved_srpm_sig,
              mgmt.name AS approved_mgmt_name, mgmt.signature_url AS approved_mgmt_sig,
              md.name AS approved_md_name, md.signature_url AS approved_md_sig,
              proc.name AS processed_by_name
       FROM material_requisitions mr
       JOIN projects p ON mr.project_id = p.id
       JOIN users u ON mr.raised_by = u.id
       LEFT JOIN users t ON mr.verified_tower_mgr_by = t.id
       LEFT JOIN users pm ON mr.approved_pm_by = pm.id
       LEFT JOIN users spm ON mr.approved_sr_pm_by = spm.id
       LEFT JOIN users mgmt ON mr.approved_mgmt_by = mgmt.id
       LEFT JOIN users md ON mr.approved_md_by = md.id
       LEFT JOIN users proc ON mr.processed_by = proc.id
       WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!mrs.rows.length || mrs.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'MRS not found' });
    }
    const items = await query(
      `SELECT * FROM mrs_items WHERE mrs_id = $1 ORDER BY sort_order`,
      [req.params.id]
    );
    res.json({ data: { ...mrs.rows[0], items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /stores/mrs
router.post('/', async (req, res) => {
  try {
    const { project_id, department, head_office_project_name, site_incharge, required_by, priority, remarks, items } = req.body;
    if (!project_id || !items?.length) {
      return res.status(400).json({ error: 'project_id and at least one item are required' });
    }

    const result = await withTransaction(async (client) => {
      // Verify project belongs to company
      const proj = await client.query(
        `SELECT id, name, project_code FROM projects WHERE id = $1 AND company_id = $2`,
        [project_id, req.user.company_id]
      );
      if (!proj.rows.length) throw Object.assign(new Error('Project not found'), { status: 404 });

      // Generate MRS number: BCIM-[PROJECTCODE]-[DEPT]-MR-[SEQ]
      const deptCode = (department || 'GEN').substring(0, 3).toUpperCase();
      const yr = new Date().getFullYear();
      
      const countRes = await client.query(
        `SELECT COUNT(*) FROM material_requisitions mr JOIN projects p ON mr.project_id = p.id
         WHERE p.company_id = $1 AND EXTRACT(YEAR FROM mr.created_at) = $2`,
        [req.user.company_id, yr]
      );
      const seq = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
      const mrs_number = `MRS-${yr}-${seq}`;
      const projectCode = proj.rows[0].project_code || 'PRJ';
      const serial_no_formatted = `BCIM-${projectCode}-${deptCode}-MR-${seq}`;

      const mrs = await client.query(
        `INSERT INTO material_requisitions (
           project_id, mrs_number, serial_no_formatted, department, 
           head_office_project_name, site_incharge, required_by, 
           priority, remarks, raised_by, status
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
        [
          project_id, mrs_number, serial_no_formatted, department, 
          head_office_project_name || proj.rows[0].name, 
          site_incharge, required_by, priority || 'normal', remarks, req.user.id
        ]
      );

      // Insert items
      const inserted = [];
      for (let i = 0; i < items.length; i++) {
        const { material, qty, unit, purpose } = items[i];
        if (!material || !qty || !unit) continue;
        const it = await client.query(
          `INSERT INTO mrs_items (mrs_id, material_name, quantity, unit, purpose, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [mrs.rows[0].id, material, parseFloat(qty), unit, purpose, i + 1]
        );
        inserted.push(it.rows[0]);
      }

      return { ...mrs.rows[0], items: inserted };
    });

    res.status(201).json({ message: 'MRS submitted successfully', data: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Stage-based Approval Endpoints
const APPROVAL_STAGES = {
  'verify-tower': { nextStatus: 'verified_tower', colBy: 'verified_tower_mgr_by', colAt: 'verified_tower_mgr_at', requiredPrev: 'pending',        sigCol: 'tower_sig_img' },
  'approve-pm':   { nextStatus: 'approved_pm',    colBy: 'approved_pm_by',        colAt: 'approved_pm_at',        requiredPrev: 'verified_tower', sigCol: 'pm_sig_img'    },
  'approve-srpm': { nextStatus: 'approved_srpm',  colBy: 'approved_sr_pm_by',     colAt: 'approved_sr_pm_at',     requiredPrev: 'approved_pm',    sigCol: 'srpm_sig_img'  },
  'approve-mgmt': { nextStatus: 'approved_mgmt',  colBy: 'approved_mgmt_by',      colAt: 'approved_mgmt_at',      requiredPrev: 'approved_srpm',  sigCol: 'mgmt_sig_img'  },
  'approve-md':   { nextStatus: 'approved_md',    colBy: 'approved_md_by',        colAt: 'approved_md_at',        requiredPrev: 'approved_mgmt',  sigCol: 'md_sig_img'    },
};

router.patch('/:id/:stage', async (req, res) => {
  try {
    const { stage } = req.params;
    const { remarks, purchase_data, signature_img } = req.body;

    if (!APPROVAL_STAGES[stage]) return res.status(400).json({ error: 'Invalid approval stage' });
    const cfg = APPROVAL_STAGES[stage];

    const mrs = await query(
      `SELECT mr.*, p.company_id FROM material_requisitions mr
       JOIN projects p ON mr.project_id = p.id WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!mrs.rows.length || mrs.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'MRS not found' });
    }
    if (mrs.rows[0].status !== cfg.requiredPrev) {
      return res.status(400).json({ error: `Cannot perform ${stage}. Current status: ${mrs.rows[0].status}` });
    }

    // Build dynamic SET clause
    let setSql = `status = $1, ${cfg.colBy} = $2, ${cfg.colAt} = NOW(), updated_at = NOW()`;
    const params = [cfg.nextStatus, req.user.id];

    if (remarks) { setSql += `, remarks = $${params.length + 1}`; params.push(remarks); }
    if (signature_img) { setSql += `, ${cfg.sigCol} = $${params.length + 1}`; params.push(signature_img); }

    // MD approval: purchase data
    if (stage === 'approve-md' && purchase_data) {
      const { received_date, po_no_date, expected_delivery } = purchase_data;
      setSql += `, purchase_received_date = $${params.length+1}, po_no_date = $${params.length+2}, expected_delivery_date = $${params.length+3}, processed_by = $${params.length+4}, processed_at = NOW()`;
      params.push(received_date, po_no_date, expected_delivery, req.user.id);
    }

    params.push(req.params.id);
    await query(
      `UPDATE material_requisitions SET ${setSql} WHERE id = $${params.length}`,
      params
    );

    res.json({ message: `MRS ${stage} successfully`, status: cfg.nextStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /stores/mrs/:id/reject — Anyone in the chain can reject
router.patch('/:id/reject', async (req, res) => {
  try {
    const { remarks } = req.body;
    const mrs = await query(
      `SELECT mr.*, p.company_id FROM material_requisitions mr
       JOIN projects p ON mr.project_id = p.id WHERE mr.id = $1`,
      [req.params.id]
    );
    if (!mrs.rows.length || mrs.rows[0].company_id !== req.user.company_id) {
      return res.status(404).json({ error: 'MRS not found' });
    }
    
    await query(
      `UPDATE material_requisitions
       SET status = 'rejected', remarks = $1, updated_at = NOW()
       WHERE id = $2`,
      [remarks || 'Rejected by workflow', req.params.id]
    );
    res.json({ message: 'MRS rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
