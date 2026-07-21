/**
 * OAuthLinkingService Unit Tests
 *
 * Tests the 4-branch OAuth user resolution logic:
 * 1. Session linking — authenticated user links provider to their account
 * 2. Duplicate provider — provider ID already linked to a different user
 * 3. Email auto-link — email matches an existing user
 * 4. New user creation — no matches found
 *
 * Also tests resolveExistingSessionUser with linkUserId and accessToken fallback.
 */

import { User } from '../../models/User';
import { AuthenticationService } from '../../services/authentication/AuthenticationService';
import {
    OAuthLinkingService,
    OAuthUserResolutionOpts,
} from '../../services/authentication/OAuthLinkingService';
import { UserService } from '../../services/user/UserService';

// Mock dependencies
jest.mock('../../services/user/UserService');
jest.mock('../../services/authentication/AuthenticationService');

describe('OAuthLinkingService', () => {
  let service: OAuthLinkingService;
  let mockUserService: jest.Mocked<UserService>;
  let mockAuthService: jest.Mocked<AuthenticationService>;

  const mockUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      discordId: 'discord-123',
      role: 'user',
      ...overrides,
    }) as User;

  const baseOpts: OAuthUserResolutionOpts = {
    providerName: 'Google',
    providerId: 'google-456',
    providerIdField: 'googleId',
    email: 'oauth@google.com',
    username: 'googleuser',
    displayName: 'Google User',
    avatar: 'https://example.com/avatar.png',
    ipAddress: '127.0.0.1',
    lookupByProviderId: jest.fn().mockResolvedValue(null),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserService = new UserService() as jest.Mocked<UserService>;
    mockAuthService = new AuthenticationService() as jest.Mocked<AuthenticationService>;

    // Default mock implementations
    mockUserService.getUserById = jest.fn().mockResolvedValue(null);
    mockUserService.getUserByEmail = jest.fn().mockResolvedValue(null);
    mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);
    mockUserService.createUser = jest.fn().mockImplementation(async (data: Partial<User>) => mockUser(data));

    service = new OAuthLinkingService(mockUserService, mockAuthService);
  });

  // ==================== resolveExistingSessionUser ====================

  describe('resolveExistingSessionUser', () => {
    it('should return null when no linkUserId and no accessToken', async () => {
      const result = await service.resolveExistingSessionUser();
      expect(result).toBeNull();
    });

    it('should resolve user by linkUserId (priority 1)', async () => {
      const user = mockUser({ id: 'link-user-1' });
      mockUserService.getUserById = jest.fn().mockResolvedValue(user);

      const result = await service.resolveExistingSessionUser('link-user-1');

      expect(result).toBe(user);
      expect(mockUserService.getUserById).toHaveBeenCalledWith('link-user-1');
    });

    it('should fall back to accessToken when linkUserId not found', async () => {
      const user = mockUser({ id: 'token-user-1' });
      mockUserService.getUserById = jest
        .fn()
        .mockResolvedValueOnce(null) // linkUserId not found
        .mockResolvedValueOnce(user); // token lookup succeeds
      mockAuthService.validateAccessToken = jest
        .fn()
        .mockResolvedValue({ id: 'token-user-1' });

      const result = await service.resolveExistingSessionUser('missing-id', 'valid-token');

      expect(result).toBe(user);
      expect(mockAuthService.validateAccessToken).toHaveBeenCalledWith('valid-token');
    });

    it('should return null when accessToken is invalid/expired', async () => {
      mockAuthService.validateAccessToken = jest
        .fn()
        .mockRejectedValue(new Error('Token expired'));

      const result = await service.resolveExistingSessionUser(undefined, 'expired-token');

      expect(result).toBeNull();
    });

    it('should prefer linkUserId over accessToken', async () => {
      const linkUser = mockUser({ id: 'link-user' });
      mockUserService.getUserById = jest.fn().mockResolvedValue(linkUser);

      const result = await service.resolveExistingSessionUser('link-user', 'some-token');

      expect(result).toBe(linkUser);
      // Should not attempt token validation since linkUserId resolved
      expect(mockAuthService.validateAccessToken).not.toHaveBeenCalled();
    });
  });

  // ==================== resolveOrCreateOAuthUser ====================

  describe('resolveOrCreateOAuthUser', () => {
    describe('Scenario 1: Session linking', () => {
      it('should link provider to authenticated user', async () => {
        const sessionUser = mockUser({ id: 'session-user' });
        mockUserService.getUserById = jest.fn().mockResolvedValue(sessionUser);

        const result = await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          linkUserId: 'session-user',
        });

        expect(result.tag).toBe('linked');
        if (result.tag === 'linked') {
          expect(result.user.id).toBe('session-user');
        }
        expect(mockUserService.updateUser).toHaveBeenCalledWith(
          'session-user',
          expect.objectContaining({
            googleId: 'google-456',
            lastLoginIp: '127.0.0.1',
          })
        );
      });
    });

    describe('Scenario 2: Duplicate provider', () => {
      it('should return duplicate_provider when provider ID is linked to different user', async () => {
        const sessionUser = mockUser({ id: 'session-user' });
        const otherUser = mockUser({ id: 'other-user', googleId: 'google-456' });

        mockUserService.getUserById = jest.fn().mockResolvedValue(sessionUser);
        const lookupByProviderId = jest.fn().mockResolvedValue(otherUser);

        const result = await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          linkUserId: 'session-user',
          lookupByProviderId,
        });

        expect(result.tag).toBe('duplicate_provider');
        if (result.tag === 'duplicate_provider') {
          expect(result.providerId).toBe('google-456');
          expect(result.targetUserId).toBe('session-user');
        }
        // Should NOT call updateUser
        expect(mockUserService.updateUser).not.toHaveBeenCalled();
      });

      it('should allow linking when provider ID belongs to same user', async () => {
        const sessionUser = mockUser({ id: 'session-user' });
        mockUserService.getUserById = jest.fn().mockResolvedValue(sessionUser);
        const lookupByProviderId = jest.fn().mockResolvedValue(sessionUser); // same user

        const result = await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          linkUserId: 'session-user',
          lookupByProviderId,
        });

        expect(result.tag).toBe('linked');
        expect(mockUserService.updateUser).toHaveBeenCalled();
      });
    });

    describe('Scenario 3: Email auto-link', () => {
      it('should link provider to existing user by email match', async () => {
        const emailUser = mockUser({ id: 'email-user', email: 'oauth@google.com' });
        mockUserService.getUserByEmail = jest.fn().mockResolvedValue(emailUser);

        const result = await service.resolveOrCreateOAuthUser(baseOpts);

        expect(result.tag).toBe('linked');
        if (result.tag === 'linked') {
          expect(result.user.id).toBe('email-user');
        }
        expect(mockUserService.updateUser).toHaveBeenCalledWith(
          'email-user',
          expect.objectContaining({ googleId: 'google-456' })
        );
      });

      it('should skip email auto-link when email is undefined', async () => {
        const result = await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          email: undefined,
        });

        expect(result.tag).toBe('created');
        expect(mockUserService.getUserByEmail).not.toHaveBeenCalled();
      });
    });

    describe('Scenario 4: New user creation', () => {
      it('should create a new user when no matches found', async () => {
        const result = await service.resolveOrCreateOAuthUser(baseOpts);

        expect(result.tag).toBe('created');
        expect(mockUserService.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            googleId: 'google-456',
            username: 'googleuser',
            email: 'oauth@google.com',
            displayName: 'Google User',
            avatar: 'https://example.com/avatar.png',
            role: 'user',
            discordId: 'google:google-456', // prefixed provider ID
          })
        );
      });

      it('should generate fallback email when provider email is undefined', async () => {
        await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          email: undefined,
        });

        expect(mockUserService.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'google-456@noemail.google.local',
          })
        );
      });

      it('should use provider name for discordId prefix', async () => {
        await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          providerName: 'Twitch',
          providerIdField: 'twitchId',
          providerId: 'twitch-789',
          lookupByProviderId: jest.fn().mockResolvedValue(null),
        });

        expect(mockUserService.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            discordId: 'twitch:twitch-789',
            twitchId: 'twitch-789',
          })
        );
      });
    });

    describe('Priority ordering', () => {
      it('should prefer session linking over email auto-link', async () => {
        const sessionUser = mockUser({ id: 'session-user' });
        const emailUser = mockUser({ id: 'email-user' });
        mockUserService.getUserById = jest.fn().mockResolvedValue(sessionUser);
        mockUserService.getUserByEmail = jest.fn().mockResolvedValue(emailUser);

        const result = await service.resolveOrCreateOAuthUser({
          ...baseOpts,
          linkUserId: 'session-user',
        });

        expect(result.tag).toBe('linked');
        if (result.tag === 'linked') {
          expect(result.user.id).toBe('session-user');
        }
        // Should not check email since session user was found
        expect(mockUserService.getUserByEmail).not.toHaveBeenCalled();
      });

      it('should prefer email auto-link over new user creation', async () => {
        const emailUser = mockUser({ id: 'email-user' });
        mockUserService.getUserByEmail = jest.fn().mockResolvedValue(emailUser);

        const result = await service.resolveOrCreateOAuthUser(baseOpts);

        expect(result.tag).toBe('linked');
        expect(mockUserService.createUser).not.toHaveBeenCalled();
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
