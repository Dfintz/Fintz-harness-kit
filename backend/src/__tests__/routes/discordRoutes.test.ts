/**
 * Discord Routes — Cross-Tenant Authorization Tests
 *
 * Verifies that the guild-scoped endpoints under `/api/v2/discord/*`
 * reject access from organizations that have not linked the requested guild.
 *
 * Threat covered: a member of org A could previously call any
 * `/discord/guild/:guildId/*` or `/discord/roles/:guildId/:userId` endpoint
 * with org B's guildId and receive that guild's roles, channels, or even
 * mutate role assignments via the bot's session, because the routes did
 * no organization↔guild binding check.
 */

// ---------------------------------------------------------------------------
// Mocks (must come BEFORE imports of the SUT)
// ---------------------------------------------------------------------------

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Stub the auth middleware so we can inject a synthetic req.user without JWTs.
const mockUser: { id: string; username: string; role: string; currentOrganizationId?: string } = {
  id: 'user-1',
  username: 'tester',
  role: 'member',
  currentOrganizationId: 'org-a',
};

jest.mock('../../middleware/auth', () => {
  const actual = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticateToken: (req: any, _res: any, next: any) => {
      req.user = { ...mockUser };
      next();
    },
    authenticateWithTenant: (req: any, _res: any, next: any) => {
      req.user = { ...mockUser };
      next();
    },
  };
});

jest.mock('../../middleware/autoRefreshToken', () => ({
  autoRefreshDiscordToken: (_req: any, _res: any, next: any) => next(),
}));

// The settings sub-router is unrelated to this test surface.
jest.mock('../../controllers/discord/discordSettingsController', () => ({
  router: require('express').Router(),
}));

// Mock DiscordService — we only need to verify whether downstream operations
// are invoked when the access check passes / blocked when it fails.
const mockGetUserRoles = jest.fn();
const mockAssignRole = jest.fn();
const mockRemoveRole = jest.fn();
const mockGetGuildRoles = jest.fn();
const mockGetGuildChannels = jest.fn();

jest.mock('../../services/discord/DiscordService', () => ({
  getDiscordService: () => ({
    getUserRoles: mockGetUserRoles,
    assignRole: mockAssignRole,
    removeRole: mockRemoveRole,
    getGuildRoles: mockGetGuildRoles,
    getGuildChannels: mockGetGuildChannels,
  }),
}));

// Mock DiscordSettingsService — we only care that requireGuildAccess is called
// with the user's currentOrganizationId and the guildId from the URL.
const mockRequireGuildAccess = jest.fn();
jest.mock('../../services/discord/DiscordSettingsService', () => {
  const { ForbiddenError } = jest.requireActual('../../utils/apiErrors');
  return {
    DiscordSettingsService: class {
      requireGuildAccess = mockRequireGuildAccess;
    },
    discordSettingsService: { requireGuildAccess: mockRequireGuildAccess },
    __esModule: true,
    ForbiddenError,
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import express, { Application } from 'express';
import request from 'supertest';

import { router as discordRouter } from '../../routes/discordRoutes';
import { ForbiddenError } from '../../utils/apiErrors';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const VALID_GUILD_ID = '123456789012345678'; // 18-digit Discord snowflake
const VALID_USER_ID = '987654321098765432';
const VALID_ROLE_ID = '111111111111111111';

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v2', discordRouter);
  return app;
}

function arrangeAccessGranted() {
  mockRequireGuildAccess.mockResolvedValue({
    organizationId: mockUser.currentOrganizationId,
    guildId: VALID_GUILD_ID,
  });
}

function arrangeAccessDenied(message = 'Discord guild is not linked to your organization') {
  mockRequireGuildAccess.mockRejectedValue(
    new ForbiddenError(message, {
      resource: 'discord_guild',
      action: 'access',
      resourceId: VALID_GUILD_ID,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Discord Routes — cross-tenant guild authorization', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.currentOrganizationId = 'org-a';
    app = buildApp();
  });

  describe('GET /discord/guild/:guildId/roles', () => {
    it('returns 200 when user current org owns the guild', async () => {
      arrangeAccessGranted();
      mockGetGuildRoles.mockResolvedValue([{ id: 'r1', name: 'Admin' }]);

      const response = await request(app).get(`/api/v2/discord/guild/${VALID_GUILD_ID}/roles`);

      expect(response.status).toBe(200);
      expect(mockRequireGuildAccess).toHaveBeenCalledWith('org-a', VALID_GUILD_ID);
      expect(mockGetGuildRoles).toHaveBeenCalledWith(VALID_GUILD_ID);
      expect(response.body).toEqual({ success: true, data: [{ id: 'r1', name: 'Admin' }] });
    });

    it('returns 403 when current org does not own the guild', async () => {
      arrangeAccessDenied();

      const response = await request(app).get(`/api/v2/discord/guild/${VALID_GUILD_ID}/roles`);

      expect(response.status).toBe(403);
      expect(mockGetGuildRoles).not.toHaveBeenCalled();
      expect(response.body.error).toMatch(/not linked/i);
    });

    it('returns 403 when user has no current organization', async () => {
      mockUser.currentOrganizationId = undefined;
      arrangeAccessDenied('No active organization context for Discord guild access');

      const response = await request(app).get(`/api/v2/discord/guild/${VALID_GUILD_ID}/roles`);

      expect(response.status).toBe(403);
      expect(mockRequireGuildAccess).toHaveBeenCalledWith(undefined, VALID_GUILD_ID);
      expect(mockGetGuildRoles).not.toHaveBeenCalled();
    });

    it('returns 400 when guildId is malformed (and skips access check)', async () => {
      const response = await request(app).get('/api/v2/discord/guild/not-a-snowflake/roles');

      expect(response.status).toBe(400);
      expect(mockRequireGuildAccess).not.toHaveBeenCalled();
      expect(mockGetGuildRoles).not.toHaveBeenCalled();
    });
  });

  describe('GET /discord/guild/:guildId/channels', () => {
    it('returns 200 when access is granted', async () => {
      arrangeAccessGranted();
      mockGetGuildChannels.mockResolvedValue([{ id: 'c1', name: 'general' }]);

      const response = await request(app).get(`/api/v2/discord/guild/${VALID_GUILD_ID}/channels`);

      expect(response.status).toBe(200);
      expect(mockGetGuildChannels).toHaveBeenCalledWith(VALID_GUILD_ID);
    });

    it('returns 403 when access is denied', async () => {
      arrangeAccessDenied();

      const response = await request(app).get(`/api/v2/discord/guild/${VALID_GUILD_ID}/channels`);

      expect(response.status).toBe(403);
      expect(mockGetGuildChannels).not.toHaveBeenCalled();
    });
  });

  describe('GET /discord/roles/:guildId/:userId', () => {
    it('returns 200 when access is granted', async () => {
      arrangeAccessGranted();
      mockGetUserRoles.mockResolvedValue(['r1', 'r2']);

      const response = await request(app).get(
        `/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`
      );

      expect(response.status).toBe(200);
      expect(mockGetUserRoles).toHaveBeenCalledWith(VALID_GUILD_ID, VALID_USER_ID);
    });

    it('returns 403 and does not call Discord when access is denied', async () => {
      arrangeAccessDenied();

      const response = await request(app).get(
        `/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`
      );

      expect(response.status).toBe(403);
      expect(mockGetUserRoles).not.toHaveBeenCalled();
    });
  });

  describe('POST /discord/roles/:guildId/:userId (write)', () => {
    it('assigns the role when access is granted', async () => {
      arrangeAccessGranted();
      mockAssignRole.mockResolvedValue('Role assigned');

      const response = await request(app)
        .post(`/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`)
        .send({ roleId: VALID_ROLE_ID });

      expect(response.status).toBe(200);
      expect(mockAssignRole).toHaveBeenCalledWith(VALID_GUILD_ID, VALID_USER_ID, VALID_ROLE_ID);
    });

    it('returns 403 and does NOT mutate Discord when access is denied', async () => {
      arrangeAccessDenied();

      const response = await request(app)
        .post(`/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`)
        .send({ roleId: VALID_ROLE_ID });

      expect(response.status).toBe(403);
      expect(mockAssignRole).not.toHaveBeenCalled();
    });

    it('returns 400 when roleId is malformed (and never reaches access check)', async () => {
      const response = await request(app)
        .post(`/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`)
        .send({ roleId: 'not-a-snowflake' });

      expect(response.status).toBe(400);
      expect(mockRequireGuildAccess).not.toHaveBeenCalled();
      expect(mockAssignRole).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /discord/roles/:guildId/:userId (write)', () => {
    it('removes the role when access is granted', async () => {
      arrangeAccessGranted();
      mockRemoveRole.mockResolvedValue('Role removed');

      const response = await request(app)
        .delete(`/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`)
        .send({ roleId: VALID_ROLE_ID });

      expect(response.status).toBe(200);
      expect(mockRemoveRole).toHaveBeenCalledWith(VALID_GUILD_ID, VALID_USER_ID, VALID_ROLE_ID);
    });

    it('returns 403 and does NOT mutate Discord when access is denied', async () => {
      arrangeAccessDenied();

      const response = await request(app)
        .delete(`/api/v2/discord/roles/${VALID_GUILD_ID}/${VALID_USER_ID}`)
        .send({ roleId: VALID_ROLE_ID });

      expect(response.status).toBe(403);
      expect(mockRemoveRole).not.toHaveBeenCalled();
    });
  });
});
