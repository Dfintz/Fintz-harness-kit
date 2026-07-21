import express, { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import request from 'supertest';

const mockLogger = {
  warn: jest.fn(),
};

const mockMembershipRepo = {
  findOne: jest.fn(),
};

const callOrder: string[] = [];

type TestRequest = Request & {
  user?: {
    id: string;
    username: string;
    role: string;
    currentOrganizationId?: string;
  };
};

const authenticateMock = jest.fn((req: TestRequest, _res: Response, next: NextFunction) => {
  callOrder.push('authenticate');
  req.user = {
    id: 'user-1',
    username: 'pilot',
    role: 'member',
  };
  next();
});

const tenantContextMiddlewareMock = jest.fn(
  (req: TestRequest, _res: Response, next: NextFunction) => {
    callOrder.push('tenantContextMiddleware');
    req.user = {
      id: req.user?.id ?? 'user-1',
      username: req.user?.username ?? 'pilot',
      role: req.user?.role ?? 'member',
      currentOrganizationId: 'org-1',
    };
    req.tenantContext = {
      organizationId: 'org-1',
      userId: req.user.id,
      userRole: req.user.role,
      organizationRole: 'member',
    };
    next();
  }
);

const requireTenantContextMock = jest.fn(
  (_req: TestRequest, _res: Response, next: NextFunction) => {
    callOrder.push('requireTenantContext');
    next();
  }
);

const validateSchemaFactoryMock = jest.fn((_schema, target) => {
  return (_req: Request, _res: Response, next: NextFunction) => {
    callOrder.push(`validateSchema:${target}`);
    next();
  };
});

const controllerHandlers = {
  getOrgConfig: jest.fn(),
  getOrgStatus: jest.fn(),
  getOrgStats: jest.fn(),
  updateOrgConfig: jest.fn(),
  deleteOrgConfig: jest.fn(),
  getOrgWhitelistSuggestions: jest.fn(),
  getFedConfig: jest.fn(),
  getFedStatus: jest.fn(),
  getFedStats: jest.fn(),
  updateFedConfig: jest.fn(),
  deleteFedConfig: jest.fn(),
  getFedWhitelistSuggestions: jest.fn(),
  listAccessible: jest.fn(),
  lookupOrgByRsiSid: jest.fn((_req: Request, res: Response) => {
    callOrder.push('controller:lookupOrgByRsiSid');
    res.status(200).json({ id: 'org-1', name: 'Org One' });
  }),
  getPositiveRelationshipFederations: jest.fn((_req: Request, res: Response) => {
    callOrder.push('controller:getPositiveRelationshipFederations');
    res.status(200).json([]);
  }),
  updatePlatformChannelData: jest.fn(),
  generateVoiceToken: jest.fn(),
  validateVoiceToken: jest.fn(),
};

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: TestRequest, res: Response, next: NextFunction) =>
    authenticateMock(req, res, next),
}));

jest.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: (req: TestRequest, res: Response, next: NextFunction) =>
    tenantContextMiddlewareMock(req, res, next),
  requireTenantContext: (req: TestRequest, res: Response, next: NextFunction) =>
    requireTenantContextMock(req, res, next),
  requireOrganizationRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../../middleware/schemaValidation', () => ({
  validateSchema: (schema: unknown, target: unknown) => validateSchemaFactoryMock(schema, target),
}));

jest.mock('../../middleware/internalServiceAuth', () => ({
  internalServiceAuthRequired: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockMembershipRepo),
  },
}));

jest.mock('../../controllers/v2/VoiceServerController', () => ({
  VoiceServerController: jest.fn().mockImplementation(() => controllerHandlers),
}));

jest.mock('../../utils/logger', () => ({
  logger: mockLogger,
}));

import { voiceServerRouter } from '../../routes/v2/voiceServerRoutes';

describe('voiceServerRoutes lookup middleware order', () => {
  let app: Application;

  beforeEach(() => {
    callOrder.length = 0;
    jest.clearAllMocks();
    mockMembershipRepo.findOne.mockResolvedValue(null);

    app = express();
    app.use(helmet());
    app.use(express.json());
    app.use('/api/v2', voiceServerRouter);
  });

  it('runs authenticate -> tenant context -> tenant requirement -> schema -> controller for org lookup', async () => {
    await request(app).get('/api/v2/voice/org-lookup?rsiSid=ORGONE').expect(200);

    expect(callOrder).toEqual([
      'authenticate',
      'tenantContextMiddleware',
      'requireTenantContext',
      'validateSchema:query',
      'controller:lookupOrgByRsiSid',
    ]);
  });

  it('runs authenticate -> tenant context -> tenant requirement -> controller for federation relationships', async () => {
    await request(app).get('/api/v2/voice/federations-with-relationships').expect(200);

    expect(callOrder).toEqual([
      'authenticate',
      'tenantContextMiddleware',
      'requireTenantContext',
      'controller:getPositiveRelationshipFederations',
    ]);
  });

  it('returns a voice-server-specific forbidden message for non-writer roles', async () => {
    mockMembershipRepo.findOne.mockResolvedValue({ role: { name: 'member' } });

    const response = await request(app)
      .put('/api/v2/organizations/org-1/voice-server/config')
      .send({ enabled: true, serverType: 'mumble', host: 'voice.example.com', port: 64738 })
      .expect(403);

    expect(response.body).toMatchObject({
      error: 'Insufficient permissions',
      message: 'Only organization founders, owners, and admins can manage voice server settings',
      required: ['founder', 'owner', 'admin'],
      current: 'member',
    });
    expect(controllerHandlers.updateOrgConfig).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Denied organization voice server write', {
      userId: 'user-1',
      targetOrgId: 'org-1',
      activeOrgId: 'org-1',
      tenantContextOrganizationRole: 'member',
      requestedOrganizationRole: 'member',
      resolvedOrganizationRole: 'member',
      usedMembershipLookup: true,
      path: '/organizations/org-1/voice-server/config',
      method: 'PUT',
    });
  });

  it('rejects stale founder tenant context when target org membership is missing', async () => {
    tenantContextMiddlewareMock.mockImplementationOnce(
      (req: TestRequest, _res: Response, next: NextFunction) => {
        callOrder.push('tenantContextMiddleware');
        req.user = {
          id: req.user?.id ?? 'user-1',
          username: req.user?.username ?? 'pilot',
          role: req.user?.role ?? 'member',
          currentOrganizationId: 'org-stale',
        };
        req.tenantContext = {
          organizationId: 'org-stale',
          userId: req.user.id,
          userRole: req.user.role,
          organizationRole: 'founder',
        };
        next();
      }
    );
    mockMembershipRepo.findOne.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/v2/organizations/org-1/voice-server/config')
      .send({ enabled: true, serverType: 'mumble', host: 'voice.example.com', port: 64738 })
      .expect(403);

    expect(response.body).toMatchObject({
      error: 'Insufficient permissions',
      message: 'Only organization founders, owners, and admins can manage voice server settings',
      required: ['founder', 'owner', 'admin'],
    });
    expect(response.body).not.toHaveProperty('current');
    expect(mockMembershipRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', organizationId: 'org-1', isActive: true },
      relations: ['role'],
    });
    expect(mockMembershipRepo.findOne).toHaveBeenCalledTimes(1);
    expect(controllerHandlers.updateOrgConfig).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Denied organization voice server write', {
      userId: 'user-1',
      targetOrgId: 'org-1',
      activeOrgId: 'org-stale',
      tenantContextOrganizationRole: 'founder',
      requestedOrganizationRole: undefined,
      resolvedOrganizationRole: undefined,
      usedMembershipLookup: true,
      path: '/organizations/org-1/voice-server/config',
      method: 'PUT',
    });
  });

  it('allows founders on the active org even when tenant context role is stale', async () => {
    tenantContextMiddlewareMock.mockImplementationOnce(
      (req: TestRequest, _res: Response, next: NextFunction) => {
        callOrder.push('tenantContextMiddleware');
        req.user = {
          id: req.user?.id ?? 'user-1',
          username: req.user?.username ?? 'pilot',
          role: req.user?.role ?? 'member',
          currentOrganizationId: 'org-1',
        };
        req.tenantContext = {
          organizationId: 'org-1',
          userId: req.user.id,
          userRole: req.user.role,
          organizationRole: 'member',
        };
        next();
      }
    );
    mockMembershipRepo.findOne.mockResolvedValue({ role: { name: 'founder' } });
    controllerHandlers.updateOrgConfig.mockImplementationOnce((_req: Request, res: Response) => {
      callOrder.push('controller:updateOrgConfig');
      res.status(200).json({ success: true });
    });

    await request(app)
      .put('/api/v2/organizations/org-1/voice-server/config')
      .send({ enabled: true, serverType: 'mumble', host: 'voice.example.com', port: 64738 })
      .expect(200);

    expect(mockMembershipRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', organizationId: 'org-1', isActive: true },
      relations: ['role'],
    });
    expect(controllerHandlers.updateOrgConfig).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('allows founders on the requested org even when tenant context is pinned to another org', async () => {
    tenantContextMiddlewareMock.mockImplementationOnce(
      (req: TestRequest, _res: Response, next: NextFunction) => {
        callOrder.push('tenantContextMiddleware');
        req.user = {
          id: req.user?.id ?? 'user-1',
          username: req.user?.username ?? 'pilot',
          role: req.user?.role ?? 'member',
          currentOrganizationId: 'org-stale',
        };
        req.tenantContext = {
          organizationId: 'org-stale',
          userId: req.user.id,
          userRole: req.user.role,
          organizationRole: 'member',
        };
        next();
      }
    );
    mockMembershipRepo.findOne.mockResolvedValue({ role: { name: 'founder' } });
    controllerHandlers.updateOrgConfig.mockImplementationOnce((_req: Request, res: Response) => {
      callOrder.push('controller:updateOrgConfig');
      res.status(200).json({ success: true });
    });

    await request(app)
      .put('/api/v2/organizations/org-1/voice-server/config')
      .send({ enabled: true, serverType: 'mumble', host: 'voice.example.com', port: 64738 })
      .expect(200);

    expect(mockMembershipRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', organizationId: 'org-1', isActive: true },
      relations: ['role'],
    });
    expect(controllerHandlers.updateOrgConfig).toHaveBeenCalled();
    expect(callOrder).toEqual([
      'validateSchema:params',
      'authenticate',
      'tenantContextMiddleware',
      'requireTenantContext',
      'validateSchema:body',
      'controller:updateOrgConfig',
    ]);
  });
});
