// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');

// Generate tokens
const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role, company_id: user.company_id };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
  return { accessToken, refreshToken };
};

// POST /api/v1/auth/register
const register = async (req, res) => {
  try {
    const {
      company_name, company_gstin, company_pan,
      name, email, phone, password, role = 'admin'
    } = req.body;

    // Check email exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const result = await withTransaction(async (client) => {
      // Create company
      const companyRes = await client.query(
        `INSERT INTO companies (name, gstin, pan) VALUES ($1, $2, $3) RETURNING id`,
        [company_name, company_gstin, company_pan]
      );
      const companyId = companyRes.rows[0].id;

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      const empCode = `EMP-${Date.now().toString().slice(-6)}`;

      // Create user
      const userRes = await client.query(
        `INSERT INTO users (company_id, employee_code, name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, role, company_id`,
        [companyId, empCode, name, email, phone, passwordHash, role]
      );
      return userRes.rows[0];
    });

    const tokens = generateTokens(result);

    res.status(201).json({
      message: 'Registration successful',
      user: { id: result.id, name: result.name, email: result.email, role: result.role },
      ...tokens
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.designation, u.signature_url, u.password_hash, u.is_active,
              u.company_id, u.last_login, u.accessible_modules,
              c.name as company_name, c.gstin as company_gstin
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    if (!user.is_active) return res.status(401).json({ error: 'Account deactivated.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password.' });

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Save refresh token
    const tokens = generateTokens(user);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken]
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        signature_url: user.signature_url,
        company_id: user.company_id,
        company_name: user.company_name,
        company_gstin: user.company_gstin,
        accessible_modules: user.accessible_modules
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required.' });

    const stored = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    if (!stored.rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token.' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);

    const tokens = generateTokens(user.rows[0]);

    // Rotate refresh token
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'30 days\')',
      [user.rows[0].id, tokens.refreshToken]
    );

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token.' });
  }
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.designation, u.phone,
              u.signature_url, u.accessible_modules,
              u.employee_code, u.last_login, u.created_at,
              c.name as company_name, c.gstin as company_gstin
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/v1/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);

    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect.' });

    const newHash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]);

    // Invalidate all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);

    res.json({ message: 'Password changed successfully. Please login again.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/v1/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, name, email, phone, mobile, designation, department, signature_url } = req.body;
    const resolvedName  = full_name || name;
    const resolvedPhone = phone || mobile;

    await query(
      `UPDATE users
       SET name        = COALESCE($1, name),
           email       = COALESCE($2, email),
           phone       = COALESCE($3, phone),
           designation = COALESCE($4, designation),
           department  = COALESCE($5, department),
           signature_url = COALESCE($6, signature_url),
           updated_at  = NOW()
       WHERE id = $7`,
      [resolvedName, email, resolvedPhone, designation, department, signature_url, req.user.id]
    );

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.designation, u.department, u.phone,
              u.signature_url, u.accessible_modules,
              u.employee_code, u.last_login, u.created_at,
              c.name as company_name, c.gstin as company_gstin
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/v1/auth/company
const updateCompany = async (req, res) => {
  try {
    const {
      company_name, company_gstin, company_pan, company_cin,
      company_state, company_address, company_email, company_phone,
      // also accept without prefix
      name, gstin, pan, cin, state, address, email, phone
    } = req.body;

    await query(
      `UPDATE companies
       SET name       = COALESCE($1, name),
           gstin      = COALESCE($2, gstin),
           pan        = COALESCE($3, pan),
           cin        = COALESCE($4, cin),
           state      = COALESCE($5, state),
           address    = COALESCE($6, address),
           email      = COALESCE($7, email),
           phone      = COALESCE($8, phone),
           updated_at = NOW()
       WHERE id = $9`,
      [
        company_name    || name,
        company_gstin   || gstin,
        company_pan     || pan,
        company_cin     || cin,
        company_state   || state,
        company_address || address,
        company_email   || email,
        company_phone   || phone,
        req.user.company_id,
      ]
    );

    res.json({ message: 'Company details updated successfully' });
  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/v1/auth/profile  (alias for /me with more fields)
const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.designation, u.department, u.phone,
              u.signature_url, u.accessible_modules,
              u.employee_code, u.last_login, u.created_at,
              c.id as company_id, c.name as company_name, c.gstin as company_gstin,
              c.pan as company_pan, c.cin as company_cin, c.state as company_state,
              c.address as company_address, c.email as company_email, c.phone as company_phone
       FROM users u JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, refreshToken, logout, getMe, getProfile, updateProfile, updateCompany, changePassword };
