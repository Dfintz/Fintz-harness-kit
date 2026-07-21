/**
 * RSI User Link Bot Routes — verificationUrl contract tests
 *
 * Locks the API response shape for bot-facing RSI link endpoints so
 * `verificationUrl` remains present when a verification code exists.
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/botRequestAuth', () => ({
  validateBotToken: (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
  validateBotRequest: (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next(),
}));

jest.mock('../../jobs/rsiSyncScheduler', () => ({
  triggerManualSync: jest.fn(),
}));

jest.mock('../../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getSettingsByGuildId: jest.fn(),
  },
}));

jest.mock('../../services/rsi', () => ({
  rsiBotUserLookupService: {
    isAvailable: jest.fn(),
    getPlatformUserIdByDiscordId: jest.fn(),
  },
  rsiUserLinkService: {
    getLinkByDiscordAndOrg: jest.fn(),
    updateLink: jest.fn(),
    createLink: jest.fn(),
    deleteLink: jest.fn(),
    verifyBioCodeOnly: jest.fn(),
  },
  rsiSyncScheduleService: {
    getScheduleStatus: jest.fn(),
  },
  rsiSyncAuditService: {
    getLogs: jest.fn(),
  },
}));

import express, { Application } from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { setRsiUserLinkBotRoutes } from '../../routes/rsiUserLinkBotRoutes';
import { rsiBotUserLookupService, rsiUserLinkService } from '../../services/rsi';

type MockLink = {
  id: string;
  userId: string;
  organizationId: string;
  discordUserId: string;
  rsiHandle: string;
  verificationCode?: string;
  verificationMethod: 'bio_code';
  verifiedAt: Date | null;
  syncStatus: string;
  isVerified: () => boolean;
};

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const DISCORD_USER_ID = ['123456', '789012', '345678'].join('');
const VERIFICATION_CODE = 'SCFM-ABC123FF';
const FRONTEND_URL = 'https://fleet.example.test';
const DISCORD_SSO_LOGIN_URL = 'http://localhost:3000/api/v2/auth/discord';

function buildApp(): Application {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json());
  setRsiUserLinkBotRoutes(app);
  return app;
}

function makeLink(overrides: Partial<MockLink> = {}): MockLink {
  return {
    id: 'link-1',
    userId: 'user-1',
    organizationId: ORG_ID,
    discordUserId: DISCORD_USER_ID,
    rsiHandle: 'PilotOne',
    verificationCode: VERIFICATION_CODE,
    verificationMethod: 'bio_code',
    verifiedAt: null,
    syncStatus: 'pending',
    isVerified: () => false,
    ...overrides,
  };
}

describe('rsiUserLinkBotRoutes verificationUrl contract', () => {
  let app: Application;
  let mockLookupService: jest.Mocked<typeof rsiBotUserLookupService>;
  let mockService: jest.Mocked<typeof rsiUserLinkService>;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FRONTEND_URL = FRONTEND_URL;
    app = buildApp();
    mockLookupService = jest.mocked(rsiBotUserLookupService);
    mockService = jest.mocked(rsiUserLinkService);
    mockLookupService.isAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
      return;
    }

    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  it('returns verificationUrl on create-link response when verificationCode exists', async () => {
    const link = makeLink();
    mockService.getLinkByDiscordAndOrg.mockResolvedValue(null);
    mockLookupService.getPlatformUserIdByDiscordId.mockResolvedValue('platform-user-1');
    mockService.createLink.mockResolvedValue(link);

    const response = await request(app)
      .post(`/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/rsi-link`)
      .send({ rsiHandle: 'PilotOne', verificationMethod: 'bio_code' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.created).toBe(true);
    expect(response.body.data.rsiHandle).toBe('PilotOne');
    expect(response.body.data.verificationCode).toBe(VERIFICATION_CODE);
    expect(response.body.data.verificationUrl).toBe(
      `${FRONTEND_URL}/verify/rsi/${VERIFICATION_CODE}`
    );
    expect(mockService.createLink).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'platform-user-1', discordUserId: DISCORD_USER_ID })
    );
  });

  it('returns created=false on create-link when an existing link is updated', async () => {
    const existing = makeLink({ id: 'link-existing' });
    const updated = makeLink({ id: 'link-updated', rsiHandle: 'UpdatedPilot' });

    mockService.getLinkByDiscordAndOrg.mockResolvedValue(existing);
    mockService.updateLink.mockResolvedValue(updated);

    const response = await request(app)
      .post(`/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/rsi-link`)
      .send({ rsiHandle: 'UpdatedPilot', verificationMethod: 'bio_code' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.created).toBe(false);
    expect(response.body.data.id).toBe('link-updated');
    expect(response.body.data.rsiHandle).toBe('UpdatedPilot');
    expect(response.body.data.verificationUrl).toBe(
      `${FRONTEND_URL}/verify/rsi/${VERIFICATION_CODE}`
    );
  });

  it('returns 404 on create-link when the Discord user is not mapped to a platform user', async () => {
    mockService.getLinkByDiscordAndOrg.mockResolvedValue(null);
    mockLookupService.getPlatformUserIdByDiscordId.mockResolvedValue(null);

    const response = await request(app)
      .post(`/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/rsi-link`)
      .send({ rsiHandle: 'PilotOne', verificationMethod: 'bio_code' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'No platform user linked to this Discord account',
      errorCode: 'DISCORD_ACCOUNT_NOT_LINKED',
      message: 'Sign in with Discord SSO on the web app, then retry this command.',
      loginUrl: DISCORD_SSO_LOGIN_URL,
    });
    expect(mockService.createLink).not.toHaveBeenCalled();
  });

  it('returns 503 on create-link when user lookup is unavailable', async () => {
    mockService.getLinkByDiscordAndOrg.mockResolvedValue(null);
    mockLookupService.isAvailable.mockReturnValue(false);

    const response = await request(app)
      .post(`/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/rsi-link`)
      .send({ rsiHandle: 'PilotOne', verificationMethod: 'bio_code' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'User lookup is temporarily unavailable' });
    expect(mockLookupService.getPlatformUserIdByDiscordId).not.toHaveBeenCalled();
    expect(mockService.createLink).not.toHaveBeenCalled();
  });

  it('returns verificationUrl on link-status response when verificationCode exists', async () => {
    const link = makeLink();
    mockService.getLinkByDiscordAndOrg.mockResolvedValue(link);

    const response = await request(app).get(
      `/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/rsi-link`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.rsiHandle).toBe('PilotOne');
    expect(response.body.data.verificationCode).toBe(VERIFICATION_CODE);
    expect(response.body.data.verificationUrl).toBe(
      `${FRONTEND_URL}/verify/rsi/${VERIFICATION_CODE}`
    );
  });

  it('returns verificationUrl in verify-check when link is already verified', async () => {
    const link = makeLink({ isVerified: () => true, verifiedAt: new Date() });
    mockService.getLinkByDiscordAndOrg.mockResolvedValue(link);

    const response = await request(app)
      .post(`/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/verify-check`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      verified: true,
      rsiHandle: 'PilotOne',
      verificationUrl: `${FRONTEND_URL}/verify/rsi/${VERIFICATION_CODE}`,
      message: 'Already verified',
    });
  });

  it('returns verificationUrl in verify-check when verification is still pending', async () => {
    const link = makeLink({ isVerified: () => false, verifiedAt: null });
    mockService.getLinkByDiscordAndOrg.mockResolvedValue(link);
    mockService.verifyBioCodeOnly.mockResolvedValue({
      success: true,
      verified: false,
      error: 'Verification link not found in bio',
    });

    const response = await request(app)
      .post(`/api/bot/rsi/organizations/${ORG_ID}/users/${DISCORD_USER_ID}/verify-check`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({
      verified: false,
      rsiHandle: 'PilotOne',
      verificationUrl: `${FRONTEND_URL}/verify/rsi/${VERIFICATION_CODE}`,
      error: 'Verification link not found in bio',
    });
  });
});
