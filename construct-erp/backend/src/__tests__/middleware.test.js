const jwt = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query:           jest.fn(),
  withTransaction: jest.fn(),
  pool:            { query: jest.fn(), on: jest.fn() },
}));

const { query } = require('../config/database');
const { authenticate, authorize, projectAccess } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  headers: {},
  user: null,
  params: {},
  body: {},
  ...overrides,
});

const makeToken = (payload = {}, secret = JWT_SECRET, opts = {}) =>
  jwt.sign({ id: 'user-1', role: 'admin', company_id: 'co-1', ...payload }, secret, { expiresIn: '1h', ...opts });

const activeUser = { id: 'user-1', role: 'admin', company_id: 'co-1', is_active: true };

beforeEach(() => jest.clearAllMocks());

// ─── AUTHENTICATE ─────────────────────────────────────────────────────────────

describe('authenticate()', () => {
  it('calls next() and sets req.user for a valid token', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser] });
    const token = makeToken();
    const req  = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res  = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(activeUser);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = mockReq();
    const res = mockRes();
    await authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token is invalid', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer not-a-real-token' } });
    const res = mockRes();
    await authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with "Token expired" message for expired token', async () => {
    const token = makeToken({}, JWT_SECRET, { expiresIn: '0s' });
    await new Promise(r => setTimeout(r, 10)); // ensure expiry

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    await authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/expired/i) }));
  });

  it('returns 401 when user not found in DB', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const token = makeToken();
    const req   = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res   = mockRes();
    await authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for deactivated user', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...activeUser, is_active: false }] });
    const token = makeToken();
    const req   = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res   = mockRes();
    await authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringMatching(/deactivated/i) }));
  });
});

// ─── AUTHORIZE ────────────────────────────────────────────────────────────────

describe('authorize()', () => {
  it('calls next() when user role is in allowed list', () => {
    const req  = mockReq({ user: { ...activeUser, role: 'admin' } });
    const res  = mockRes();
    const next = jest.fn();
    authorize('super_admin', 'admin')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when user role is not in allowed list', () => {
    const req  = mockReq({ user: { ...activeUser, role: 'site_engineer' } });
    const res  = mockRes();
    const next = jest.fn();
    authorize('super_admin', 'admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── PROJECT ACCESS ───────────────────────────────────────────────────────────

describe('projectAccess()', () => {
  it('calls next() immediately if no projectId in request', async () => {
    const req  = mockReq({ user: activeUser });
    const next = jest.fn();
    await projectAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });

  it('bypasses DB check for admin roles', async () => {
    const req  = mockReq({ user: { ...activeUser, role: 'super_admin' }, params: { projectId: 'proj-1' } });
    const next = jest.fn();
    await projectAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
  });

  it('calls next() when site_engineer is a project member', async () => {
    query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    const req = mockReq({
      user: { ...activeUser, role: 'site_engineer' },
      params: { projectId: 'proj-1' },
    });
    const next = jest.fn();
    await projectAccess(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when site_engineer has no project membership', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const req = mockReq({
      user: { ...activeUser, role: 'site_engineer' },
      params: { projectId: 'proj-999' },
    });
    const res  = mockRes();
    const next = jest.fn();
    await projectAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
