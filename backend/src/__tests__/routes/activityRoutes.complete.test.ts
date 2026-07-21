jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const authUser = {
  id: 'user-1',
  username: 'tester',
  role: 'member',
};

let mockCurrentOrganizationId: string | undefined = 'org-1';
let includeTenantContext = true;

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      ...authUser,
      currentOrganizationId: mockCurrentOrganizationId,
    };
    next();
  },
  authenticateWithTenant: (req: any, _res: any, next: any) => {
    req.user = {
      ...authUser,
      currentOrganizationId: mockCurrentOrganizationId,
    };

    if (includeTenantContext && mockCurrentOrganizationId) {
      req.tenantContext = {
        organizationId: mockCurrentOrganizationId,
        userId: authUser.id,
        userRole: authUser.role,
      };
    }

    next();
  },
}));

const completeActivityMock = jest.fn((req: any, res: any) => {
  res.status(200).json({
    ok: true,
    receivedBody: req.body,
  });
});

const buildControllerProxy = (overrides: Record<string, unknown>) =>
  new Proxy(overrides, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as keyof typeof target];
      }

      return jest.fn((_req: any, res: any) => {
        res.status(200).json({ ok: true });
      });
    },
  });

const activityControllerInstance = buildControllerProxy({
  completeActivity: completeActivityMock,
});

const readyCheckControllerInstance = buildControllerProxy({});
const operationCommandControllerInstance = buildControllerProxy({});
const activityStarCommsControllerInstance = buildControllerProxy({});

jest.mock('../../controllers/v2/activityController', () => ({
  ActivityControllerV2: jest.fn().mockImplementation(() => activityControllerInstance),
}));

jest.mock('../../controllers/v2/readyCheckController', () => ({
  ReadyCheckController: jest.fn().mockImplementation(() => readyCheckControllerInstance),
}));

jest.mock('../../controllers/v2/operationCommandController', () => ({
  OperationCommandController: jest
    .fn()
    .mockImplementation(() => operationCommandControllerInstance),
}));

jest.mock('../../controllers/v2/activityStarCommsController', () => ({
  ActivityStarCommsController: jest
    .fn()
    .mockImplementation(() => activityStarCommsControllerInstance),
}));

import express, { Application } from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { router as activityRouter } from '../../routes/v2/activities';

function buildApp(): Application {
  const app = express();
  app.use(helmet());
  app.use(express.json());
  app.use('/api/v2', activityRouter);
  return app;
}

describe('Activity complete route validation', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentOrganizationId = 'org-1';
    includeTenantContext = true;
    app = buildApp();
  });

  it('accepts complete payload with report/attendanceCount/notes', async () => {
    const payload = {
      report: 'Operation successful, no incidents.',
      attendanceCount: 4,
      notes: 'Everyone arrived on time.',
    };

    const response = await request(app)
      .post('/api/v2/activities/activity-1/complete')
      .send(payload);

    expect(response.status).toBe(200);
    expect(completeActivityMock).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      ok: true,
      receivedBody: payload,
    });
  });

  it('rejects legacy completion payload shape before controller execution', async () => {
    const response = await request(app).post('/api/v2/activities/activity-1/complete').send({
      success: true,
      actualDuration: 90,
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Validation error');
    expect(completeActivityMock).not.toHaveBeenCalled();
  });

  it('rejects empty completion payload before controller execution', async () => {
    const response = await request(app).post('/api/v2/activities/activity-1/complete').send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message', 'Validation error');
    expect(completeActivityMock).not.toHaveBeenCalled();
  });

  it('allows complete route when tenant context is absent for authenticated personal activity edge', async () => {
    mockCurrentOrganizationId = undefined;
    includeTenantContext = false;

    const payload = {
      report: 'Personal activity completion report',
    };

    const response = await request(app)
      .post('/api/v2/activities/activity-1/complete')
      .send(payload);

    expect(response.status).toBe(200);
    expect(completeActivityMock).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      ok: true,
      receivedBody: payload,
    });
  });
});
