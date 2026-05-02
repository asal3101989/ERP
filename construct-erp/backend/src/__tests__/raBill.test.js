const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query:           jest.fn(),
  withTransaction: jest.fn(),
  pool:            { query: jest.fn(), on: jest.fn() },
}));

const { query, withTransaction } = require('../config/database');
const { calculateRaBill } = require('../controllers/raBill.controller');
const app = require('../server');

const JWT_SECRET = process.env.JWT_SECRET;
const makeToken = (role = 'qs_engineer') =>
  jwt.sign({ id: 'user-1', role, company_id: 'co-1' }, JWT_SECRET, { expiresIn: '1h' });

const activeUser = (role = 'qs_engineer') => ({
  id: 'user-1', role, company_id: 'co-1', is_active: true,
});

beforeEach(() => jest.clearAllMocks());

// ─── calculateRaBill() pure function ──────────────────────────────────────────

describe('calculateRaBill()', () => {
  const base = { gross_amount: 100000 };

  it('calculates 18% GST by default', () => {
    const r = calculateRaBill(base);
    expect(r.gst_amount).toBe(18000);
    expect(r.gross_with_gst).toBe(118000);
  });

  it('calculates 5% retention by default', () => {
    expect(calculateRaBill(base).retention_amount).toBe(5000);
  });

  it('calculates 2% TDS by default', () => {
    expect(calculateRaBill(base).tds_amount).toBe(2000);
  });

  it('net_payable = gross_with_gst − total_deductions', () => {
    const r = calculateRaBill(base);
    expect(r.net_payable).toBe(118000 - r.total_deductions);
  });

  it('includes all optional deductions in total', () => {
    const r = calculateRaBill({
      gross_amount: 100000,
      mobilization_advance_recovery: 5000,
      material_recovery_total: 3000,
      delay_penalty: 1000,
      other_deductions: 500,
    });
    // retention=5000, tds=2000, mob=5000, mat=3000, delay=1000, other=500 = 16500
    expect(r.total_deductions).toBe(16500);
  });

  it('respects custom retention_pct and tds_rate', () => {
    const r = calculateRaBill({ gross_amount: 100000, retention_pct: 10, tds_rate: 1 });
    expect(r.retention_amount).toBe(10000);
    expect(r.tds_amount).toBe(1000);
  });
});

// ─── POST /api/v1/ra-bills ────────────────────────────────────────────────────

describe('POST /api/v1/ra-bills', () => {
  const payload = {
    project_id: 'proj-1',
    bill_number: 'RA-001',
    bill_date: '2026-04-01',
    gross_amount: 50000,
    gst_amount: 9000,
    retention_percent: 5,
    mobilization_advance_recovery: 0,
    contractor_name: 'Build Corp',
    contractor_pan: 'ABCCE1234F',
    items: [{ boq_item_id: 'boq-1', current_qty: 100, rate: 500 }],
  };

  it('qs_engineer can create a bill (201)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('qs_engineer')] });
    withTransaction.mockResolvedValueOnce({ id: 'ra-1', ...payload });

    const res = await request(app)
      .post('/api/v1/ra-bills')
      .set('Authorization', `Bearer ${makeToken('qs_engineer')}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
  });

  it('returns 500 on transaction failure', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('qs_engineer')] });
    withTransaction.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/v1/ra-bills')
      .set('Authorization', `Bearer ${makeToken('qs_engineer')}`)
      .send(payload);

    expect(res.status).toBe(500);
  });

  it('blocks accountant from creating (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('accountant')] });

    const res = await request(app)
      .post('/api/v1/ra-bills')
      .set('Authorization', `Bearer ${makeToken('accountant')}`)
      .send(payload);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/v1/ra-bills/:id/approve ──────────────────────────────────────

describe('PATCH /api/v1/ra-bills/:id/approve', () => {
  it('sets bill to certified status', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser('admin')] })       // authenticate
      .mockResolvedValueOnce({ rows: [{ id: 'ra-1', status: 'certified' }] }); // UPDATE

    const res = await request(app)
      .patch('/api/v1/ra-bills/ra-1/approve')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('blocks accountant from approving (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('accountant')] });

    const res = await request(app)
      .patch('/api/v1/ra-bills/ra-1/approve')
      .set('Authorization', `Bearer ${makeToken('accountant')}`)
      .send({});

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/v1/ra-bills/:id/reject ───────────────────────────────────────

describe('PATCH /api/v1/ra-bills/:id/reject', () => {
  it('sets bill to rejected status', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser('admin')] })
      .mockResolvedValueOnce({ rows: [{ id: 'ra-1', status: 'rejected' }] });

    const res = await request(app)
      .patch('/api/v1/ra-bills/ra-1/reject')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ remarks: 'Needs correction' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
  });
});

// ─── GET /api/v1/ra-bills ────────────────────────────────────────────────────

describe('GET /api/v1/ra-bills', () => {
  it('returns list of bills for the company', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser('admin')] })
      .mockResolvedValueOnce({ rows: [{ id: 'ra-1', bill_number: 'RA-001' }] });

    const res = await request(app)
      .get('/api/v1/ra-bills')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
