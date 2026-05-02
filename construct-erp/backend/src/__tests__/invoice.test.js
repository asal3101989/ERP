const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query:           jest.fn(),
  withTransaction: jest.fn(),
  pool:            { query: jest.fn(), on: jest.fn() },
}));

const { query, withTransaction } = require('../config/database');
const { calculateGST, calculateTDS } = require('../controllers/invoice.controller');
const app = require('../server');

const JWT_SECRET = process.env.JWT_SECRET;
const makeToken  = (role = 'accountant') =>
  jwt.sign({ id: 'user-1', role, company_id: 'co-1' }, JWT_SECRET, { expiresIn: '1h' });
const activeUser = (role = 'accountant') => ({
  id: 'user-1', role, company_id: 'co-1', is_active: true,
});

beforeEach(() => jest.clearAllMocks());

// ─── calculateGST() pure function ─────────────────────────────────────────────

describe('calculateGST()', () => {
  it('splits evenly into CGST+SGST for intra-state', () => {
    const r = calculateGST(100000, 'cgst_sgst');
    expect(r.cgst_amount).toBe(9000);
    expect(r.sgst_amount).toBe(9000);
    expect(r.igst_amount).toBe(0);
    expect(r.total_gst).toBe(18000);
    expect(r.total_amount).toBe(118000);
  });

  it('applies full IGST for inter-state', () => {
    const r = calculateGST(100000, 'igst');
    expect(r.igst_amount).toBe(18000);
    expect(r.cgst_amount).toBe(0);
    expect(r.total_amount).toBe(118000);
  });

  it('returns zero GST for exempt type', () => {
    const r = calculateGST(100000, 'exempt');
    expect(r.total_gst).toBe(0);
    expect(r.total_amount).toBe(100000);
  });

  it('respects custom GST rate (12%)', () => {
    const r = calculateGST(100000, 'cgst_sgst', 12);
    expect(r.cgst_amount).toBe(6000);
    expect(r.sgst_amount).toBe(6000);
    expect(r.total_gst).toBe(12000);
  });
});

// ─── calculateTDS() pure function ─────────────────────────────────────────────

describe('calculateTDS()', () => {
  it('applies 1% for individual PAN (4th char P)', () => {
    expect(calculateTDS(100000, 'ABCPE1234F')).toBe(1000);
  });

  it('applies 1% for HUF PAN (4th char H)', () => {
    expect(calculateTDS(100000, 'ABCHE1234F')).toBe(1000);
  });

  it('applies 2% for company PAN (4th char C)', () => {
    expect(calculateTDS(100000, 'ABCCE1234F')).toBe(2000);
  });

  it('applies 2% for firm PAN (4th char F)', () => {
    expect(calculateTDS(100000, 'ABCFE1234F')).toBe(2000);
  });

  it('applies 2% as default when PAN is null', () => {
    expect(calculateTDS(100000, null)).toBe(2000);
  });
});

// ─── POST /api/v1/invoices (vendor 3-way match) ───────────────────────────────

describe('POST /api/v1/invoices', () => {
  const validPayload = {
    project_id: 'proj-1',
    vendor_id: 'vendor-1',
    invoice_number: 'INV-001',
    invoice_date: '2026-04-01',
    total_amount: 118000,
    tax_amount: 18000,
    net_amount: 100000,
    items: [{ material_name: 'Cement', unit: 'Bag', quantity_on_grn: 100, quantity_invoiced: 100, rate_on_po: 350, rate_invoiced: 350, tax_percent: 18, tax_amount: 6300, net_amount: 35000 }],
  };

  it('creates invoice and returns 201', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser()] });
    withTransaction.mockResolvedValueOnce({ id: 'inv-1', ...validPayload });

    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
  });

  it('returns 400 when required fields are missing', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser()] });

    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ project_id: 'proj-1' }); // missing vendor_id, invoice_number, items

    expect(res.status).toBe(400);
  });

  it('blocks site_engineer from creating (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('site_engineer')] });

    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${makeToken('site_engineer')}`)
      .send(validPayload);

    expect(res.status).toBe(403);
  });

  it('returns 500 on DB transaction error', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser()] });
    withTransaction.mockRejectedValueOnce(new Error('constraint violation'));

    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(validPayload);

    expect(res.status).toBe(500);
  });
});

// ─── PATCH /api/v1/invoices/:id/verify ────────────────────────────────────────

describe('PATCH /api/v1/invoices/:id/verify', () => {
  it('accountant can verify an invoice', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser()] })
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await request(app)
      .patch('/api/v1/invoices/inv-1/verify')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified/i);
  });

  it('blocks site_engineer from verifying (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('site_engineer')] });

    const res = await request(app)
      .patch('/api/v1/invoices/inv-1/verify')
      .set('Authorization', `Bearer ${makeToken('site_engineer')}`);

    expect(res.status).toBe(403);
  });
});
