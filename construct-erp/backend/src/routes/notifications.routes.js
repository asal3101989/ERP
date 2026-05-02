// src/routes/notifications.routes.js
// Aggregates live alerts from existing tables — no separate notifications table needed
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const router = express.Router();
router.use(authenticate);

// Helper: safe count query — returns 0 on missing table / column
async function safeCount(sql, params) {
  try {
    const r = await query(sql, params);
    return parseInt(r.rows[0]?.count || 0);
  } catch (_) { return 0; }
}

// Helper: safe rows query
async function safeRows(sql, params) {
  try {
    const r = await query(sql, params);
    return r.rows;
  } catch (_) { return []; }
}

// GET /notifications  — live alert feed for the logged-in company
router.get('/', async (req, res) => {
  try {
    const cid = req.user.company_id;
    const items = [];

    // ── 1. GRNs pending stores verification ──────────────────────────────────
    const pendingGrns = await safeCount(
      `SELECT COUNT(*) FROM grn g
       JOIN projects p ON g.project_id = p.id
       WHERE p.company_id = $1 AND g.quality_status = 'pending'`,
      [cid]
    );
    if (pendingGrns > 0) {
      items.push({
        id: 'grn-pending',
        type: 'grn',
        severity: 'warning',
        icon: 'package',
        title: `${pendingGrns} GRN${pendingGrns > 1 ? 's' : ''} Awaiting Verification`,
        body: 'Stores team needs to verify receipt',
        link: '/stores/grn',
        category: 'Stores',
      });
    }

    // ── 2. GRNs stores-verified but not QC-approved ───────────────────────────
    const verifiedGrns = await safeCount(
      `SELECT COUNT(*) FROM grn g
       JOIN projects p ON g.project_id = p.id
       WHERE p.company_id = $1 AND g.quality_status = 'verified_stores'`,
      [cid]
    );
    if (verifiedGrns > 0) {
      items.push({
        id: 'grn-verified',
        type: 'grn',
        severity: 'info',
        icon: 'package-check',
        title: `${verifiedGrns} GRN${verifiedGrns > 1 ? 's' : ''} Pending Final Approval`,
        body: 'Verified by stores — awaiting QC / accounts approval',
        link: '/stores/grn',
        category: 'Stores',
      });
    }

    // ── 3. Out-of-stock materials ─────────────────────────────────────────────
    const outOfStock = await safeCount(
      `SELECT COUNT(*) FROM inventory i
       JOIN projects p ON i.project_id = p.id
       WHERE p.company_id = $1 AND i.closing_stock <= 0`,
      [cid]
    );
    if (outOfStock > 0) {
      items.push({
        id: 'stock-zero',
        type: 'stock',
        severity: 'error',
        icon: 'alert-triangle',
        title: `${outOfStock} Material${outOfStock > 1 ? 's' : ''} Out of Stock`,
        body: 'Closing stock is zero — raise MRS or GRN immediately',
        link: '/stores/ledger',
        category: 'Stores',
      });
    }

    // ── 4. Pending vendor invoices ────────────────────────────────────────────
    const pendingInvoices = await safeCount(
      `SELECT COUNT(*) FROM invoices i
       JOIN projects p ON i.project_id = p.id
       WHERE p.company_id = $1 AND i.status IN ('pending','submitted')`,
      [cid]
    );
    if (pendingInvoices > 0) {
      items.push({
        id: 'invoice-pending',
        type: 'invoice',
        severity: 'warning',
        icon: 'file-text',
        title: `${pendingInvoices} Invoice${pendingInvoices > 1 ? 's' : ''} Pending Approval`,
        body: 'Vendor invoices awaiting verification / authorization',
        link: '/finance/invoices',
        category: 'Finance',
      });
    }

    // ── 5. Pending MRS (material requisitions) ────────────────────────────────
    const pendingMrs = await safeCount(
      `SELECT COUNT(*) FROM mrs m
       JOIN projects p ON m.project_id = p.id
       WHERE p.company_id = $1 AND m.status = 'pending'`,
      [cid]
    );
    if (pendingMrs > 0) {
      items.push({
        id: 'mrs-pending',
        type: 'mrs',
        severity: 'info',
        icon: 'clipboard-list',
        title: `${pendingMrs} Material Requisition${pendingMrs > 1 ? 's' : ''} Pending`,
        body: 'MRS raised by site — awaiting stores / procurement action',
        link: '/stores/mrs',
        category: 'Stores',
      });
    }

    // ── 6. Pending leave requests ─────────────────────────────────────────────
    const pendingLeaves = await safeCount(
      `SELECT COUNT(*) FROM hr_leave hl
       JOIN users u ON hl.user_id = u.id
       WHERE u.company_id = $1 AND hl.status = 'pending'`,
      [cid]
    );
    if (pendingLeaves > 0) {
      items.push({
        id: 'leave-pending',
        type: 'leave',
        severity: 'info',
        icon: 'calendar-off',
        title: `${pendingLeaves} Leave Request${pendingLeaves > 1 ? 's' : ''} Pending`,
        body: 'Employee leave applications awaiting approval',
        link: '/hr-admin/leaves',
        category: 'HR',
      });
    }

    // ── 7. Open IT support tickets ────────────────────────────────────────────
    const openTickets = await safeCount(
      `SELECT COUNT(*) FROM it_tickets t
       WHERE t.company_id = $1 AND t.status IN ('open','in_progress')`,
      [cid]
    );
    if (openTickets > 0) {
      items.push({
        id: 'tickets-open',
        type: 'ticket',
        severity: 'info',
        icon: 'ticket',
        title: `${openTickets} Help Desk Ticket${openTickets > 1 ? 's' : ''} Open`,
        body: 'IT support tickets awaiting resolution',
        link: '/it/tickets',
        category: 'IT',
      });
    }

    // ── 8. Expiring permits (within 3 days) ───────────────────────────────────
    const expiringPermits = await safeCount(
      `SELECT COUNT(*) FROM permits pt
       JOIN projects p ON pt.project_id = p.id
       WHERE p.company_id = $1
         AND pt.status = 'approved'
         AND pt.valid_to BETWEEN NOW() AND NOW() + INTERVAL '3 days'`,
      [cid]
    );
    if (expiringPermits > 0) {
      items.push({
        id: 'permits-expiring',
        type: 'permit',
        severity: 'error',
        icon: 'key',
        title: `${expiringPermits} Work Permit${expiringPermits > 1 ? 's' : ''} Expiring Soon`,
        body: 'Permits expiring within 3 days — renew before work stops',
        link: '/hse/permits',
        category: 'HSE',
      });
    }

    // ── 9. Open snags ─────────────────────────────────────────────────────────
    const openSnags = await safeRows(
      `SELECT COUNT(*) AS count
       FROM snag_items si
       JOIN projects p ON si.project_id = p.id
       WHERE p.company_id = $1 AND si.status IN ('open','in_progress')`,
      [cid]
    );
    const snagCount = parseInt(openSnags[0]?.count || 0);
    if (snagCount > 0) {
      items.push({
        id: 'snags-open',
        type: 'snag',
        severity: 'warning',
        icon: 'hammer',
        title: `${snagCount} Open Snag${snagCount > 1 ? 's' : ''}`,
        body: 'Quality snags not yet resolved on site',
        link: '/quality/snags',
        category: 'Quality',
      });
    }

    // ── 10. POs with no delivery (overdue) ────────────────────────────────────
    const overduePOs = await safeCount(
      `SELECT COUNT(*) FROM purchase_orders po
       JOIN projects p ON po.project_id = p.id
       WHERE p.company_id = $1
         AND po.status NOT IN ('closed','cancelled')
         AND po.expected_delivery < NOW() - INTERVAL '1 day'`,
      [cid]
    );
    if (overduePOs > 0) {
      items.push({
        id: 'po-overdue',
        type: 'po',
        severity: 'error',
        icon: 'truck',
        title: `${overduePOs} Purchase Order${overduePOs > 1 ? 's' : ''} Overdue`,
        body: 'Expected delivery date has passed — follow up with vendor',
        link: '/procurement/po',
        category: 'Procurement',
      });
    }

    res.json({ count: items.length, items });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
