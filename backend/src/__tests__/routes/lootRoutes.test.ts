/**
 * Loot routes integration tests for scoped manager authorization.
 *
 * Verifies that pool-scoped management endpoints rely on service-level
 * leader/creator/assistant checks (not global LOOT:manage middleware), and
 * that pool-scoped OCR scanning honors the same scoped authorization.
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const authUser = {
  id: 'assistant-user-1',
  username: 'assistant',
  role: 'member',
  currentOrganizationId: '11111111-1111-4111-8111-111111111111',
};

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { ...authUser };
    next();
  },
}));

jest.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: (req: any, _res: any, next: any) => {
    req.tenantContext = {
      organizationId: authUser.currentOrganizationId,
      userId: authUser.id,
      userRole: authUser.role,
    };
    next();
  },
  requireTenantContext: (_req: any, _res: any, next: any) => next(),
}));

const mockRequirePermissionMiddleware = jest
  .fn()
  .mockImplementation((_req: any, res: any, _next: any) => {
    res.status(403).json({ message: 'Permission denied by test middleware' });
  });

jest.mock('../../middleware/permissionMiddleware', () => ({
  requirePermission: jest.fn(() => mockRequirePermissionMiddleware),
}));

jest.mock('../../middleware/schemaValidation', () => ({
  validateSchema: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

const mockSingleUpload = jest.fn(() => (req: any, _res: any, next: any) => {
  req.file = { buffer: Buffer.from('fake-image-bytes') };
  next();
});

jest.mock('../../middleware/fileValidation', () => ({
  imageUploadConfig: {
    single: (...args: unknown[]) => mockSingleUpload(...args),
  },
  handleFileUploadError: (_err: unknown, _req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockLootService = {
  listPools: jest.fn(),
  getPoolDetail: jest.fn(),
  createPool: jest.fn(),
  updatePool: jest.fn(),
  lockPool: jest.fn(),
  cancelPool: jest.fn(),
  distribute: jest.fn(),
  retryDistribution: jest.fn(),
  getPoolById: jest.fn(),
  getEligibleParticipants: jest.fn(),
  addItem: jest.fn(),
  addItemsBulk: jest.fn(),
  updateItem: jest.fn(),
  removeItem: jest.fn(),
  assignItem: jest.fn(),
  claimItem: jest.fn(),
  withdrawClaim: jest.fn(),
  assertCanManagePool: jest.fn(),
};

jest.mock('../../services/loot/LootDistributionService', () => ({
  getLootDistributionService: jest.fn(() => mockLootService),
}));

const mockOcrService = {
  extractItems: jest.fn(),
};

jest.mock('../../services/loot/LootOcrService', () => ({
  getLootOcrService: jest.fn(() => mockOcrService),
}));

import express, { Application } from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { router as lootRouter } from '../../routes/v2/loot';
import { ForbiddenError } from '../../utils/apiErrors';

const ORG_ID = authUser.currentOrganizationId;
const POOL_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
type HttpMethod = 'post' | 'patch' | 'delete';

function buildApp(): Application {
  const app = express();
  app.use(helmet());
  app.use(express.json());
  app.use('/api/v2/loot', lootRouter);
  return app;
}

describe('Loot routes scoped manager authorization', () => {
  let app: Application;

  const sendRouteRequest = async (method: HttpMethod, path: string, body?: unknown) => {
    let requestFactory;
    switch (method) {
      case 'post':
        requestFactory = request(app).post(path);
        break;
      case 'patch':
        requestFactory = request(app).patch(path);
        break;
      case 'delete':
        requestFactory = request(app).delete(path);
        break;
      default:
        throw new Error(`Unsupported method: ${String(method)}`);
    }

    if (body === undefined) {
      return requestFactory.send();
    }
    return requestFactory.send(body);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();

    mockLootService.updatePool.mockResolvedValue({ id: POOL_ID, name: 'Updated Pool' });
    mockLootService.lockPool.mockResolvedValue({ id: POOL_ID, status: 'locked' });
    mockLootService.cancelPool.mockResolvedValue({ id: POOL_ID, status: 'cancelled' });
    mockLootService.distribute.mockResolvedValue({ poolId: POOL_ID, awards: [] });
    mockLootService.retryDistribution.mockResolvedValue({ poolId: POOL_ID, awards: [] });
    mockLootService.addItem.mockResolvedValue({ id: ITEM_ID, name: 'Railgun' });
    mockLootService.addItemsBulk.mockResolvedValue([{ id: ITEM_ID, name: 'Railgun' }]);
    mockLootService.updateItem.mockResolvedValue({ id: ITEM_ID, name: 'Updated Item' });
    mockLootService.removeItem.mockResolvedValue(undefined);
    mockLootService.assignItem.mockResolvedValue({ id: ITEM_ID, awardedToUserId: 'user-target' });
    mockLootService.getPoolById.mockResolvedValue({ id: POOL_ID, status: 'open' });
    mockLootService.assertCanManagePool.mockResolvedValue({ id: POOL_ID });
    mockOcrService.extractItems.mockResolvedValue({
      suggestions: [{ name: 'Railgun', quantity: 1 }],
      rawLines: ['Railgun x1'],
      provider: 'azure-vision',
      enabled: true,
    });
  });

  it('allows pool lock for scoped manager without global LOOT:manage middleware', async () => {
    const response = await request(app).post(`/api/v2/loot/pools/${POOL_ID}/lock`).send({});

    expect(response.status).toBe(200);
    expect(mockLootService.lockPool).toHaveBeenCalledWith(ORG_ID, POOL_ID, authUser.id);
    expect(mockRequirePermissionMiddleware).not.toHaveBeenCalled();
  });

  it('returns 403 for non-manager on pool lock when service rejects authorization', async () => {
    mockLootService.lockPool.mockRejectedValueOnce(
      new ForbiddenError(
        'Only the mission leader, creator, or assigned assistant can manage this loot pool'
      )
    );

    const response = await request(app).post(`/api/v2/loot/pools/${POOL_ID}/lock`).send({});

    expect(response.status).toBe(403);
    expect(mockLootService.lockPool).toHaveBeenCalledWith(ORG_ID, POOL_ID, authUser.id);
  });

  it('allows all pool-scoped manager endpoints without global LOOT:manage middleware', async () => {
    const managerRoutes: Array<{
      label: string;
      method: HttpMethod;
      path: string;
      body?: unknown;
      expectedStatus: number;
      serviceMethod: keyof typeof mockLootService;
      expectedArgs: unknown[];
    }> = [
      {
        label: 'update pool',
        method: 'patch',
        path: `/api/v2/loot/pools/${POOL_ID}`,
        body: { name: 'Updated Pool Name' },
        expectedStatus: 200,
        serviceMethod: 'updatePool',
        expectedArgs: [ORG_ID, POOL_ID, authUser.id, { name: 'Updated Pool Name' }],
      },
      {
        label: 'cancel pool',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/cancel`,
        expectedStatus: 200,
        serviceMethod: 'cancelPool',
        expectedArgs: [ORG_ID, POOL_ID, authUser.id],
      },
      {
        label: 'distribute pool',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/distribute`,
        expectedStatus: 200,
        serviceMethod: 'distribute',
        expectedArgs: [ORG_ID, POOL_ID, authUser.id],
      },
      {
        label: 'retry distribution',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/retry-distribution`,
        expectedStatus: 200,
        serviceMethod: 'retryDistribution',
        expectedArgs: [ORG_ID, POOL_ID, authUser.id],
      },
      {
        label: 'add item',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/items`,
        body: { name: 'Railgun' },
        expectedStatus: 201,
        serviceMethod: 'addItem',
        expectedArgs: [ORG_ID, POOL_ID, authUser.id, { name: 'Railgun' }],
      },
      {
        label: 'add items bulk',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/items/bulk`,
        body: { items: [{ name: 'Railgun' }] },
        expectedStatus: 201,
        serviceMethod: 'addItemsBulk',
        expectedArgs: [ORG_ID, POOL_ID, authUser.id, [{ name: 'Railgun' }]],
      },
      {
        label: 'update item',
        method: 'patch',
        path: `/api/v2/loot/pools/${POOL_ID}/items/${ITEM_ID}`,
        body: { name: 'Refined Railgun' },
        expectedStatus: 200,
        serviceMethod: 'updateItem',
        expectedArgs: [ORG_ID, POOL_ID, ITEM_ID, authUser.id, { name: 'Refined Railgun' }],
      },
      {
        label: 'remove item',
        method: 'delete',
        path: `/api/v2/loot/pools/${POOL_ID}/items/${ITEM_ID}`,
        expectedStatus: 204,
        serviceMethod: 'removeItem',
        expectedArgs: [ORG_ID, POOL_ID, ITEM_ID, authUser.id],
      },
      {
        label: 'assign item',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/items/${ITEM_ID}/assign`,
        body: { userId: 'user-target' },
        expectedStatus: 200,
        serviceMethod: 'assignItem',
        expectedArgs: [ORG_ID, POOL_ID, ITEM_ID, authUser.id, 'user-target'],
      },
    ];

    for (const routeCase of managerRoutes) {
      const response = await sendRouteRequest(routeCase.method, routeCase.path, routeCase.body);

      expect(response.status).toBe(routeCase.expectedStatus);
      expect(mockLootService[routeCase.serviceMethod]).toHaveBeenCalledWith(
        ...routeCase.expectedArgs
      );
    }

    expect(mockRequirePermissionMiddleware).not.toHaveBeenCalled();
  });

  it('returns 403 for pool-scoped manager endpoints when service-level auth fails', async () => {
    const managerRoutes: Array<{
      label: string;
      method: HttpMethod;
      path: string;
      body?: unknown;
      serviceMethod: keyof typeof mockLootService;
    }> = [
      {
        label: 'update pool',
        method: 'patch',
        path: `/api/v2/loot/pools/${POOL_ID}`,
        body: { name: 'Updated Pool Name' },
        serviceMethod: 'updatePool',
      },
      {
        label: 'cancel pool',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/cancel`,
        serviceMethod: 'cancelPool',
      },
      {
        label: 'distribute pool',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/distribute`,
        serviceMethod: 'distribute',
      },
      {
        label: 'retry distribution',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/retry-distribution`,
        serviceMethod: 'retryDistribution',
      },
      {
        label: 'add item',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/items`,
        body: { name: 'Railgun' },
        serviceMethod: 'addItem',
      },
      {
        label: 'add items bulk',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/items/bulk`,
        body: { items: [{ name: 'Railgun' }] },
        serviceMethod: 'addItemsBulk',
      },
      {
        label: 'update item',
        method: 'patch',
        path: `/api/v2/loot/pools/${POOL_ID}/items/${ITEM_ID}`,
        body: { name: 'Refined Railgun' },
        serviceMethod: 'updateItem',
      },
      {
        label: 'remove item',
        method: 'delete',
        path: `/api/v2/loot/pools/${POOL_ID}/items/${ITEM_ID}`,
        serviceMethod: 'removeItem',
      },
      {
        label: 'assign item',
        method: 'post',
        path: `/api/v2/loot/pools/${POOL_ID}/items/${ITEM_ID}/assign`,
        body: { userId: 'user-target' },
        serviceMethod: 'assignItem',
      },
    ];

    for (const routeCase of managerRoutes) {
      (mockLootService[routeCase.serviceMethod] as jest.Mock).mockRejectedValueOnce(
        new ForbiddenError(`Denied for ${routeCase.label}`)
      );

      const response = await sendRouteRequest(routeCase.method, routeCase.path, routeCase.body);
      expect(response.status).toBe(403);
    }

    expect(mockRequirePermissionMiddleware).not.toHaveBeenCalled();
  });

  it('allows pool-scoped OCR scan for scoped manager and enforces pool-level check', async () => {
    const response = await request(app)
      .post(`/api/v2/loot/pools/${POOL_ID}/ocr/scan`)
      .attach('image', Buffer.from('img-bytes'), 'inventory.png');

    expect(response.status).toBe(200);
    expect(mockLootService.getPoolById).toHaveBeenCalledWith(ORG_ID, POOL_ID);
    expect(mockLootService.assertCanManagePool).toHaveBeenCalledWith(ORG_ID, POOL_ID, authUser.id);
    expect(mockOcrService.extractItems).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('rejects pool-scoped OCR scan when pool is not open', async () => {
    mockLootService.getPoolById.mockResolvedValueOnce({ id: POOL_ID, status: 'locked' });

    const response = await request(app)
      .post(`/api/v2/loot/pools/${POOL_ID}/ocr/scan`)
      .attach('image', Buffer.from('img-bytes'), 'inventory.png');

    expect(response.status).toBe(409);
    expect(mockLootService.assertCanManagePool).not.toHaveBeenCalled();
    expect(mockOcrService.extractItems).not.toHaveBeenCalled();
  });

  it('returns 403 for pool-scoped OCR when scoped manager check fails', async () => {
    mockLootService.assertCanManagePool.mockRejectedValueOnce(new ForbiddenError('Not allowed'));

    const response = await request(app)
      .post(`/api/v2/loot/pools/${POOL_ID}/ocr/scan`)
      .attach('image', Buffer.from('img-bytes'), 'inventory.png');

    expect(response.status).toBe(403);
    expect(mockOcrService.extractItems).not.toHaveBeenCalled();
  });

  it('keeps global OCR endpoint behind LOOT:manage middleware', async () => {
    const response = await request(app)
      .post('/api/v2/loot/ocr/scan')
      .attach('image', Buffer.from('img-bytes'), 'inventory.png');

    expect(response.status).toBe(403);
    expect(mockRequirePermissionMiddleware).toHaveBeenCalled();
    expect(mockLootService.assertCanManagePool).not.toHaveBeenCalled();
  });
});
