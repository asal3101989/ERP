const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../config/database', () => ({
  query:           jest.fn(),
  withTransaction: jest.fn(),
  pool:            { query: jest.fn(), on: jest.fn() },
}));

const { query, withTransaction } = require('../config/database');
const app = require('../server');

const JWT_SECRET = process.env.JWT_SECRET;

const makeToken = (role = 'admin') =>
  jwt.sign({ id: 'user-1', role, company_id: 'co-1' }, JWT_SECRET, { expiresIn: '1h' });

const activeUser = (role = 'admin') => ({
  id: 'user-1', role, company_id: 'co-1', is_active: true, name: 'Test',
});

const sampleProject = {
  id: 'proj-1', name: 'Test Project', company_id: 'co-1',
  status: 'active', type: 'commercial', is_active: true,
  boq_count: '3', amount_collected: '1000000', total_spent: '800000',
};

beforeEach(() => jest.clearAllMocks());

// ─── GET /projects ────────────────────────────────────────────────────────────

describe('GET /api/v1/projects', () => {
  it('returns project list for authenticated user', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser()] })         // authenticate
      .mockResolvedValueOnce({ rows: [sampleProject], rowCount: 1 }); // getProjects

    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Test Project');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });

  it('filters by status when query param provided', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser()] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .get('/api/v1/projects?status=completed')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    const sqlCall = query.mock.calls[1][0];
    expect(sqlCall).toContain('p.status');
  });
});

// ─── GET /projects/:id ────────────────────────────────────────────────────────

describe('GET /api/v1/projects/:id', () => {
  it('returns single project with computed fields', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser()] })
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, total_boq_value: '5000000', total_certified: '2000000' }] });

    const res = await request(app)
      .get('/api/v1/projects/proj-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('proj-1');
    expect(res.body).toHaveProperty('total_boq_value');
  });

  it('returns 404 for unknown project', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser()] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/v1/projects/nonexistent')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
  });
});

// ─── POST /projects ───────────────────────────────────────────────────────────

describe('POST /api/v1/projects', () => {
  const newProject = {
    project_code: 'PRJ-001', name: 'New Tower',
    type: 'residential', client_name: 'Client Ltd',
    contract_value: 10000000, start_date: '2026-01-01',
  };

  it('allows admin to create a project', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser('admin')] })  // authenticate
      .mockResolvedValueOnce({ rows: [{ id: 'proj-new', ...newProject }] }); // INSERT

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send(newProject);

    expect(res.status).toBe(201);
  });

  it('blocks site_engineer from creating a project (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('site_engineer')] });

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${makeToken('site_engineer')}`)
      .send(newProject);

    expect(res.status).toBe(403);
  });
});

// ─── PUT /projects/:id ────────────────────────────────────────────────────────

describe('PUT /api/v1/projects/:id', () => {
  it('allows project_manager to update', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser('project_manager')] })
      .mockResolvedValueOnce({ rows: [{ ...sampleProject, name: 'Updated' }] });

    const res = await request(app)
      .put('/api/v1/projects/proj-1')
      .set('Authorization', `Bearer ${makeToken('project_manager')}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('blocks accountant from updating (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('accountant')] });

    const res = await request(app)
      .put('/api/v1/projects/proj-1')
      .set('Authorization', `Bearer ${makeToken('accountant')}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /projects/:id ─────────────────────────────────────────────────────

describe('DELETE /api/v1/projects/:id', () => {
  it('allows admin to delete', async () => {
    query
      .mockResolvedValueOnce({ rows: [activeUser('admin')] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/v1/projects/proj-1')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect([200, 204]).toContain(res.status);
  });

  it('blocks project_manager from deleting (403)', async () => {
    query.mockResolvedValueOnce({ rows: [activeUser('project_manager')] });

    const res = await request(app)
      .delete('/api/v1/projects/proj-1')
      .set('Authorization', `Bearer ${makeToken('project_manager')}`);

    expect(res.status).toBe(403);
  });
});
