import express, { Application } from 'express';
import helmet from 'helmet';
import request from 'supertest';

import type { VoiceServerConfig } from '@sc-fleet-manager/shared-types';

const mockAuthenticate = jest.fn((req, _res, next) => {
  req.user = {
    id: 'user-1',
    username: 'test-user',
    role: 'admin',
    currentOrganizationId: 'industrial-star-alliance-corp',
  };
  next();
});

let storedConfig: VoiceServerConfig | null = null;

const mockVoiceService = {
  updateFedVoiceConfig: jest.fn(
    async (
      _federationId: string,
      _orgId: string,
      _userId: string,
      body: Record<string, unknown>
    ): Promise<VoiceServerConfig> => {
      storedConfig = {
        enabled: body.enabled as boolean,
        serverType: body.serverType as VoiceServerConfig['serverType'],
        host: body.host as string,
        port: body.port as number,
        displayName: body.displayName as string,
        connectUrl: body.connectUrl as string,
        sharing: body.sharing as VoiceServerConfig['sharing'],
      };
      return storedConfig;
    }
  ),
  getFederationVoiceConfigForUser: jest.fn(async (): Promise<VoiceServerConfig | null> => {
    return storedConfig;
  }),
  getFederationVoiceStatusForUser: jest.fn(async () => ({
    online: false,
    currentUsers: 0,
    maxUsers: 0,
  })),
  getFederationVoiceStatsForUser: jest.fn(async () => null),
  resolveFederationActorOrganizationId: jest.fn(async () => 'fallback-federation-org'),
  deleteFedVoiceConfig: jest.fn(async () => undefined),
  getFederationWhitelistSuggestionsForUser: jest.fn(async () => []),
  getOrgVoiceConfigForUser: jest.fn(async () => null),
  getOrgVoiceStatusForUser: jest.fn(async () => ({
    online: false,
    currentUsers: 0,
    maxUsers: 0,
  })),
  getOrgVoiceStatsForUser: jest.fn(async () => null),
  updateOrgVoiceConfig: jest.fn(async () => null),
  deleteOrgVoiceConfig: jest.fn(async () => undefined),
  getWhitelistSuggestions: jest.fn(async () => []),
  listAccessibleVoiceServers: jest.fn(async () => []),
  cachePlatformChannelData: jest.fn(async () => undefined),
  checkPlatformMumbleAccess: jest.fn(async () => true),
  getPlatformConnectInfo: jest.fn(async () => ({})),
};

jest.mock('../../middleware/auth', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
}));

jest.mock('../../services/communication/voice/VoiceServerService', () => ({
  VoiceServerService: {
    getInstance: jest.fn(() => mockVoiceService),
  },
}));

import { voiceServerRouter } from '../../routes/v2/voiceServerRoutes';

describe('VoiceServer federation config endpoint path integration', () => {
  let app: Application;

  const federationId = '550e8400-e29b-41d4-a716-446655440111';

  beforeEach(() => {
    jest.clearAllMocks();
    storedConfig = null;

    app = express();
    app.use(helmet());
    app.use(express.json());
    app.use('/api/v2', voiceServerRouter);
  });

  it('persists and returns federation voice config when sharing includes organization IDs', async () => {
    const payload = {
      enabled: true,
      serverType: 'mumble',
      host: 'voice.example.com',
      port: 64738,
      displayName: 'Federation Mumble',
      connectUrl: 'mumble://voice.example.com:64738/',
      sharing: {
        enabled: true,
        whitelist: [
          {
            type: 'organization',
            targetId: 'industrial-star-alliance-corp',
            targetName: 'Industrial Star Alliance Corp',
          },
        ],
      },
    };

    const saveResponse = await request(app)
      .put(`/api/v2/federations/${federationId}/voice-server/config`)
      .send(payload)
      .expect(200);

    expect(saveResponse.body).toMatchObject({
      enabled: true,
      serverType: 'mumble',
      host: 'voice.example.com',
      sharing: {
        enabled: true,
        whitelist: [
          expect.objectContaining({
            type: 'organization',
            targetId: 'industrial-star-alliance-corp',
          }),
        ],
      },
    });

    expect(mockVoiceService.updateFedVoiceConfig).toHaveBeenCalledWith(
      federationId,
      'industrial-star-alliance-corp',
      'user-1',
      expect.objectContaining({
        sharing: {
          enabled: true,
          whitelist: [
            expect.objectContaining({
              type: 'organization',
              targetId: 'industrial-star-alliance-corp',
            }),
          ],
        },
      })
    );
    expect(mockVoiceService.resolveFederationActorOrganizationId).not.toHaveBeenCalled();

    const readResponse = await request(app)
      .get(`/api/v2/federations/${federationId}/voice-server/config`)
      .expect(200);

    expect(readResponse.body).toMatchObject({
      sharing: {
        enabled: true,
        whitelist: [
          expect.objectContaining({
            type: 'organization',
            targetId: 'industrial-star-alliance-corp',
          }),
        ],
      },
    });

    expect(mockVoiceService.getFederationVoiceConfigForUser).toHaveBeenCalledWith(
      federationId,
      'user-1'
    );
  });

  it('rejects non-UUID federation sharing target IDs at validation layer', async () => {
    const invalidPayload = {
      enabled: true,
      serverType: 'mumble',
      host: 'voice.example.com',
      port: 64738,
      sharing: {
        enabled: true,
        whitelist: [
          {
            type: 'federation',
            targetId: 'industrial-star-alliance-corp',
            targetName: 'Industrial Star Alliance Corp',
          },
        ],
      },
    };

    const response = await request(app)
      .put(`/api/v2/federations/${federationId}/voice-server/config`)
      .send(invalidPayload)
      .expect(400);

    expect(response.body).toHaveProperty('message', 'Validation error');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'sharing.whitelist.0.targetId',
        }),
      ])
    );

    expect(mockVoiceService.updateFedVoiceConfig).not.toHaveBeenCalled();
  });

  it('falls back to federation membership org resolution when active org context is missing', async () => {
    mockAuthenticate.mockImplementationOnce((req, _res, next) => {
      req.user = {
        id: 'user-1',
        username: 'test-user',
        role: 'admin',
      };
      next();
    });

    const payload = {
      enabled: true,
      serverType: 'mumble',
      host: 'voice.example.com',
      port: 64738,
      displayName: 'Federation Mumble',
      sharing: {
        enabled: true,
        whitelist: [],
      },
    };

    await request(app)
      .put(`/api/v2/federations/${federationId}/voice-server/config`)
      .send(payload)
      .expect(200);

    expect(mockVoiceService.resolveFederationActorOrganizationId).toHaveBeenCalledWith(
      'user-1',
      federationId
    );
    expect(mockVoiceService.updateFedVoiceConfig).toHaveBeenCalledWith(
      federationId,
      'fallback-federation-org',
      'user-1',
      expect.objectContaining({
        serverType: 'mumble',
        host: 'voice.example.com',
      })
    );
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
