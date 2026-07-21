import express, { Application } from 'express';
import request from 'supertest';

import { authenticate } from '../../middleware/auth';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';

jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req, _res, next) => {
    req.user = {
      id: 'test-user-id',
      username: 'test-user',
      role: 'member',
      currentOrganizationId: 'org-123',
    };
    next();
  }),
}));

jest.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: jest.fn((req, _res, next) => next()),
  requireTenantContext: jest.fn((req, _res, next) => next()),
}));

jest.mock('../../middleware/schemaValidation', () => ({
  validateSchema: () => (_req, _res, next) => next(),
}));

jest.mock('../../middleware/rateLimiting', () => ({
  intelDeleteRateLimiter: (_req, _res, next) => next(),
  intelOfficerManagementRateLimiter: (_req, _res, next) => next(),
  intelOperationsRateLimiter: (_req, _res, next) => next(),
  intelWriteRateLimiter: (_req, _res, next) => next(),
}));

const mockIntelVaultService = {
  createEntry: jest.fn(),
  updateEntry: jest.fn(),
  deleteEntry: jest.fn(),
};

jest.mock('../../services/intel/IntelVaultService', () => ({
  IntelVaultService: jest.fn().mockImplementation(() => mockIntelVaultService),
}));

import { intelRoutes } from '../v2/intel';

describe('V2 Intel Routes - Entry Create/Update', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/v2', intelRoutes);

    (authenticate as unknown as jest.Mock).mockImplementation((req, _res, next) => {
      req.user = {
        id: 'test-user-id',
        username: 'test-user',
        role: 'member',
        currentOrganizationId: 'org-123',
      };
      next();
    });

    (tenantContextMiddleware as unknown as jest.Mock).mockImplementation((req, _res, next) => {
      next();
    });

    (requireTenantContext as unknown as jest.Mock).mockImplementation((req, _res, next) => {
      next();
    });
  });

  it('returns 401 on create when user is missing', async () => {
    (authenticate as unknown as jest.Mock).mockImplementationOnce((_req, _res, next) => next());

    const response = await request(app)
      .post('/api/v2/organizations/org-123/intel/entries')
      .send({ title: 'A', content: 'B' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
    expect(mockIntelVaultService.createEntry).not.toHaveBeenCalled();
  });

  it('returns 401 on update when user is missing', async () => {
    (authenticate as unknown as jest.Mock).mockImplementationOnce((_req, _res, next) => next());

    const response = await request(app)
      .patch('/api/v2/organizations/org-123/intel/entries/entry-1')
      .send({ title: 'Updated' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
    expect(mockIntelVaultService.updateEntry).not.toHaveBeenCalled();
  });

  it('sanitizes create payload and returns success', async () => {
    mockIntelVaultService.createEntry.mockResolvedValue({
      id: 'entry-1',
      title: 'Intel Title',
      content: 'Intel Content',
    });

    const response = await request(app)
      .post('/api/v2/organizations/org-123/intel/entries')
      .send({
        title: 'Intel Title',
        content: 'Intel Content',
        category: 'strategic',
        classification: 'RESTRICTED',
        tags: ['ops'],
        metadata: { source: 'field-report' },
        unexpectedField: 'should-be-dropped',
        constructor: 'blocked-key',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(mockIntelVaultService.createEntry).toHaveBeenCalledTimes(1);

    const [payload, userId] = mockIntelVaultService.createEntry.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];

    expect(payload.organizationId).toBe('org-123');
    expect(payload.title).toBe('Intel Title');
    expect(payload.content).toBe('Intel Content');
    expect(payload.unexpectedField).toBeUndefined();
    expect(Object.hasOwn(payload, 'constructor')).toBe(false);
    expect(userId).toBe('test-user-id');
  });

  it('returns 403 on create when access is denied', async () => {
    mockIntelVaultService.createEntry.mockRejectedValue(
      new Error('User does not have access to Intel vault')
    );

    const response = await request(app).post('/api/v2/organizations/org-123/intel/entries').send({
      title: 'Intel Title',
      content: 'Intel Content',
      category: 'strategic',
      classification: 'RESTRICTED',
    });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('sanitizes update payload and returns success', async () => {
    mockIntelVaultService.updateEntry.mockResolvedValue({
      id: 'entry-1',
      title: 'Updated Title',
    });

    const response = await request(app)
      .patch('/api/v2/organizations/org-123/intel/entries/entry-1')
      .send({
        title: 'Updated Title',
        tags: ['intel'],
        relatedEntities: ['should-be-dropped'],
        constructor: 'blocked-key',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockIntelVaultService.updateEntry).toHaveBeenCalledTimes(1);

    const [, , , payload] = mockIntelVaultService.updateEntry.mock.calls[0] as [
      string,
      string,
      string,
      Record<string, unknown>,
    ];

    expect(payload.title).toBe('Updated Title');
    expect(payload.tags).toEqual(['intel']);
    expect(payload.relatedEntities).toBeUndefined();
    expect(Object.hasOwn(payload, 'constructor')).toBe(false);
  });

  it('returns 404 on update when entry is missing', async () => {
    mockIntelVaultService.updateEntry.mockRejectedValue(new Error('Intel entry not found'));

    const response = await request(app)
      .patch('/api/v2/organizations/org-123/intel/entries/entry-missing')
      .send({ title: 'Updated Title' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Intel entry not found');
  });

  it('returns 403 on update when clearance fails', async () => {
    mockIntelVaultService.updateEntry.mockRejectedValue(
      new Error('User does not have clearance for SECRET level')
    );

    const response = await request(app)
      .patch('/api/v2/organizations/org-123/intel/entries/entry-1')
      .send({ classification: 'SECRET' });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
