// src/routes/users.routes.js — Team / User Management
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require login; create/update/delete require admin
const auth  = authenticate;
const admin = [authenticate, authorize('admin', 'super_admin')];

// GET /api/v1/users — list all users in this company
router.get('/', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, role, designation, department,
              employee_code, is_active, last_login, created_at, accessible_modules
       FROM users
       WHERE company_id = $1
       ORDER BY is_active DESC, name ASC`,
      [req.user.company_id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/users — create a new team member
router.post('/', admin, async (req, res) => {
  try {
    const { name, email, phone, password, role, designation, department, accessible_modules } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'This email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const empCode = `EMP-${Date.now().toString().slice(-6)}`;

    const result = await query(
      `INSERT INTO users
         (company_id, employee_code, name, email, phone, password_hash, role, designation, department, accessible_modules)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, email, role, designation, department, employee_code, is_active, created_at, accessible_modules`,
      [req.user.company_id, empCode, name, email, phone || null,
       passwordHash, role, designation || null, department || null,
       Array.isArray(accessible_modules) ? accessible_modules : []]
    );

    res.status(201).json({ message: 'User created successfully', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/users/:id — update user details
router.put('/:id', admin, async (req, res) => {
  try {
    const { name, email, phone, role, designation, department, is_active, accessible_modules } = req.body;

    // Ensure user belongs to this company
    const check = await query(
      'SELECT id FROM users WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'User not found.' });

    await query(
      `UPDATE users SET
         name        = COALESCE($1, name),
         email       = COALESCE($2, email),
         phone       = COALESCE($3, phone),
         role        = COALESCE($4, role),
         designation = COALESCE($5, designation),
         department  = COALESCE($6, department),
         is_active   = COALESCE($7, is_active),
         accessible_modules = COALESCE($8, accessible_modules),
         updated_at  = NOW()
       WHERE id = $9 AND company_id = $10`,
      [name, email, phone, role, designation, department,
       is_active !== undefined ? is_active : null,
       Array.isArray(accessible_modules) ? accessible_modules : null,
       req.params.id, req.user.company_id]
    );

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/users/:id/reset-password — admin resets a user's password
router.patch('/:id/reset-password', admin, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const check = await query(
      'SELECT id FROM users WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'User not found.' });

    const hash = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, req.params.id]
    );
    // Invalidate sessions
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/users/:id — deactivate (soft delete)
router.delete('/:id', admin, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });

    const check = await query(
      'SELECT id FROM users WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: 'User not found.' });

    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);

    res.json({ message: 'User deactivated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
