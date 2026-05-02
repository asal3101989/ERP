const request = require('supertest');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query:           jest.fn(),
  withTransaction: jest.fn(),
  pool:            { query: jest.fn(), on: jest.fn() },
}));

const { query, withTransaction } = require('../config/database');
const app = require('../server');

const JWT_SECRET = process.env.JWT_SECRET;

const makeToken = (payload = {}) =>
  jwt.sign({ id: 'user-1', role: 'admin', company_id: 'co-1', ...payload }, JWT_SECRET, { expiresIn: '1h' });

const mockActiveUser = {
  id: 'user-1',
  name: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin',
  company_id: 'co-1',
  is_active: true,
  designation: 'Admin',
  signature_url: null,
  company_name: 'Test Co',
  company_gstin: '29ABCDE1234F1Z5',
  password_hash: bcrypt.hashSync('Test@1234', 10),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── REGISTER ────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('creates a company and user, returns 201 with tokens', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // email check → no existing
    withTransaction.mockResolvedValueOnce({
      id: 'user-1', name: 'Test Admin', email: 'admin@test.com', role: 'admin', company_id: 'co-1',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      company_name: 'Test Co',
      company_gstin: '29ABCDE1234F1Z5',
      company_pan: 'ABCDE1234F',
      name: 'Test Admin',
      email: 'admin@test.com',
      phone: '9999999999',
      password: 'Test@1234',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('admin@test.com');
  });

  it('returns 409 when email is already registered', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

    const res = await request(app).post('/api/v1/auth/register').send({
      company_name: 'Test Co', company_gstin: 'x', company_pan: 'x',
      name: 'Someone', email: 'exists@test.com', password: 'Test@1234',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns tokens on valid credentials', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockActiveUser] })  // user lookup
      .mockResolvedValueOnce({ rows: [] })                // update last_login
      .mockResolvedValueOnce({ rows: [] });               // insert refresh token

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com', password: 'Test@1234',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('admin@test.com');
  });

  it('returns 401 for wrong password', async () => {
    query.mockResolvedValueOnce({ rows: [mockActiveUser] });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com', password: 'WrongPass!1',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 401 for unknown email', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'unknown@test.com', password: 'Test@1234',
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for deactivated account', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...mockActiveUser, is_active: false }] });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com', password: 'Test@1234',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/deactivated/i);
  });
});

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('rotates refresh token and returns new tokens', async () => {
    const refreshTok = jwt.sign({ id: 'user-1' }, JWT_SECRET, { expiresIn: '30d' });
    query
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-1', token: refreshTok }] }) // stored token
      .mockResolvedValueOnce({ rows: [mockActiveUser] })  // fetch user
      .mockResolvedValueOnce({ rows: [] })                // delete old token
      .mockResolvedValueOnce({ rows: [] });               // insert new token

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refreshTok });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('returns 401 when refresh token is missing', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 when refresh token not in DB', async () => {
    const refreshTok = jwt.sign({ id: 'user-1' }, JWT_SECRET, { expiresIn: '30d' });
    query.mockResolvedValueOnce({ rows: [] }); // not found in DB

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refreshTok });
    expect(res.status).toBe(401);
  });
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('deletes refresh token and returns success', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'some-token' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM refresh_tokens'),
      ['some-token']
    );
  });

  it('succeeds even without a refresh token in body', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

// ─── GET ME ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns user profile when authenticated', async () => {
    // authenticate middleware calls query once, then getMe calls query again
    query
      .mockResolvedValueOnce({ rows: [mockActiveUser] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ ...mockActiveUser, employee_code: 'EMP-001' }] }); // getMe

    const token = makeToken();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.com');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────

describe('POST /api/v1/auth/change-password', () => {
  it('changes password and invalidates refresh tokens', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockActiveUser] }) // authenticate
      .mockResolvedValueOnce({ rows: [{ password_hash: mockActiveUser.password_hash }] }) // fetch pw
      .mockResolvedValueOnce({ rows: [] }) // update pw
      .mockResolvedValueOnce({ rows: [] }); // delete refresh tokens

    const token = makeToken();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'Test@1234', new_password: 'New@5678' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password changed/i);
  });

  it('returns 400 for wrong current password', async () => {
    query
      .mockResolvedValueOnce({ rows: [mockActiveUser] })
      .mockResolvedValueOnce({ rows: [{ password_hash: mockActiveUser.password_hash }] });

    const token = makeToken();
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'WrongOld!1', new_password: 'New@5678' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/incorrect/i);
  });
});
