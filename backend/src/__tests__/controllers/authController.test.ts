/**
 * AuthController Unit Tests
 *
 * Tests authentication flows including login, token refresh, logout, and session management
 * Validates integration with AccountSecurityService for unified security management
 */

import { AuthController } from '../../controllers/authController';
import { generateToken } from '../../middleware/auth';
import { AuthenticationService } from '../../services/authentication';
import { AccountSecurityService } from '../../services/security';
import { UserService } from '../../services/user/UserService';
import { MockRequest, MockResponse } from '../helpers/testHelpers.helper';

// Mock dependencies
jest.mock('../../services/authentication');
jest.mock('../../services/user/UserService');
jest.mock('../../services/security');
jest.mock('../../services/discord/DiscordService');
jest.mock('../../middleware/auth');
const mockGenerateToken = generateToken as jest.MockedFunction<typeof generateToken>;

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockSecurityService: jest.Mocked<AccountSecurityService>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    role: 'user' as const,
    email: 'test@example.com',
    discordId: 'discord-123',
    twoFactorEnabled: false,
    failedTwoFactorAttempts: 0,
    failedLoginAttempts: 0,
    profileViews: 0,
    loginCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockAuthService = {
      generateTokens: jest.fn(),
      refreshTokens: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserTokens: jest.fn(),
      getUserRefreshTokens: jest.fn(),
      getUserTokens: jest.fn(),
      loginUser: jest.fn(),
      refreshToken: jest.fn(),
      logoutUser: jest.fn(),
      revokeAllSessions: jest.fn(),
    } as any;

    mockUserService = {
      validateCredentials: jest.fn(),
      getUserByUsername: jest.fn(),
      getUserById: jest.fn(),
    } as any;

    mockSecurityService = {
      recordFailedAttempt: jest.fn(),
      isAccountLocked: jest.fn(),
      getLockoutStatus: jest.fn(),
      resetFailedAttempts: jest.fn(),
    } as any;

    // Setup mocks to return instances
    (AuthenticationService as jest.Mock).mockImplementation(() => mockAuthService);
    (UserService as jest.Mock).mockImplementation(() => mockUserService);
    (AccountSecurityService.getInstance as jest.Mock).mockReturnValue(mockSecurityService);

    controller = new AuthController();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'password123' },
      });
      const res = MockResponse.create();

      mockUserService.validateCredentials.mockResolvedValue(mockUser);
      mockSecurityService.isAccountLocked.mockReturnValue(false);
      mockAuthService.generateTokens.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      } as any);
      mockSecurityService.resetFailedAttempts.mockResolvedValue(undefined);

      // Act
      await controller.login(req, res);

      // Assert
      expect(mockUserService.validateCredentials).toHaveBeenCalledWith('testuser', 'password123');
      expect(mockSecurityService.isAccountLocked).toHaveBeenCalledWith(mockUser);
      expect(mockSecurityService.resetFailedAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          user: {
            id: mockUser.id,
            username: mockUser.username,
            role: mockUser.role,
          },
        })
      );
      // Verify cookies are set for httpOnly token storage
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-token-123',
        expect.any(Object)
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token-123',
        expect.any(Object)
      );
    });

    it('should return 400 if username is missing', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { password: 'password123' },
      });
      const res = MockResponse.create();

      // Act
      await controller.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('username') }),
        })
      );
    });

    it('should return 400 if password is missing', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser' },
      });
      const res = MockResponse.create();

      // Act
      await controller.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('password') }),
        })
      );
    });

    it('should return 401 for invalid credentials when user does not exist', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'wrongpassword' },
      });
      const res = MockResponse.create();

      mockUserService.validateCredentials.mockResolvedValue(null);
      mockUserService.getUserByUsername.mockResolvedValue(undefined);

      // Act
      await controller.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Invalid credentials'),
          }),
        })
      );
    });

    it('should record failed attempt for existing user with invalid password', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'wrongpassword' },
      });
      const res = MockResponse.create();

      mockUserService.validateCredentials.mockResolvedValue(null);
      mockUserService.getUserByUsername.mockResolvedValue(mockUser);
      mockSecurityService.recordFailedAttempt.mockResolvedValue({
        isLocked: false,
        attemptsRemaining: 4,
      });

      // Act
      await controller.login(req, res);

      // Assert
      expect(mockSecurityService.recordFailedAttempt).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should warn user when attempts remaining is low (<=2)', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'wrongpassword' },
      });
      const res = MockResponse.create();

      mockUserService.validateCredentials.mockResolvedValue(null);
      mockUserService.getUserByUsername.mockResolvedValue(mockUser);
      mockSecurityService.recordFailedAttempt.mockResolvedValue({
        isLocked: false,
        attemptsRemaining: 1,
      });

      // Act
      await controller.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Invalid credentials'),
          }),
        })
      );
    });

    it('should return 403 if account is locked after failed attempt', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'wrongpassword' },
      });
      const res = MockResponse.create();

      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      mockUserService.validateCredentials.mockResolvedValue(null);
      mockUserService.getUserByUsername.mockResolvedValue(mockUser);
      mockSecurityService.recordFailedAttempt.mockResolvedValue({
        isLocked: true,
        attemptsRemaining: 0,
        lockedUntil,
      });

      // Act
      await controller.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('Account locked') }),
        })
      );
    });

    it('should return 403 if account is already locked', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'password123' },
      });
      const res = MockResponse.create();

      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      mockUserService.validateCredentials.mockResolvedValue(mockUser);
      mockSecurityService.isAccountLocked.mockReturnValue(true);
      mockSecurityService.getLockoutStatus.mockResolvedValue({
        isLocked: true,
        failedAttempts: 5,
        attemptsRemaining: 0,
        lockedUntil,
        lockoutExpiresIn: 30 * 60 * 1000,
      });

      // Act
      await controller.login(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('Account is locked') }),
        })
      );
    });

    it('should generate refresh token with IP and user agent', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { username: 'testuser', password: 'password123' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = MockResponse.create();

      mockUserService.validateCredentials.mockResolvedValue(mockUser);
      mockSecurityService.isAccountLocked.mockReturnValue(false);
      mockAuthService.generateTokens.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      } as any);
      mockSecurityService.resetFailedAttempts.mockResolvedValue(undefined);

      // Act
      await controller.login(req, res);

      // Assert
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { refreshToken: 'valid-refresh-token' },
      });
      const res = MockResponse.create();

      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      } as any);

      // Act
      await controller.refresh(req, res);

      // Assert
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.objectContaining({})
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      // Verify cookies are set for httpOnly token storage
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'new-access-token',
        expect.any(Object)
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.any(Object)
      );
    });

    it('should return 400 if refresh token is missing', async () => {
      // Arrange
      const req = MockRequest.create({ body: {} });
      const res = MockResponse.create();

      // Act
      await controller.refresh(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('refreshToken') }),
        })
      );
    });

    it('should return 403 for invalid refresh token', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { refreshToken: 'invalid-token' },
      });
      const res = MockResponse.create();

      mockAuthService.refreshTokens.mockRejectedValue(new Error('Invalid refresh token'));

      // Act
      await controller.refresh(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('Access forbidden') }),
        })
      );
    });

    it('should return 404 if user not found', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { refreshToken: 'valid-refresh-token' },
      });
      const res = MockResponse.create();

      mockAuthService.refreshTokens.mockRejectedValue(new Error('User not found'));

      // Act
      await controller.refresh(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('Access forbidden') }),
        })
      );
    });

    it('should rotate refresh token with IP and user agent', async () => {
      // Arrange
      const req = MockRequest.create({
        body: { refreshToken: 'valid-refresh-token' },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const res = MockResponse.create();

      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      } as any);

      // Act
      await controller.refresh(req, res);

      // Assert
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        'valid-refresh-token',
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
        body: { refreshToken: 'valid-refresh-token' },
      });
      const res = MockResponse.create();

      mockAuthService.revokeRefreshToken.mockResolvedValue(true);

      // Act
      await controller.logout(req, res);

      // Assert
      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
      // Verify cookies are cleared
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    });

    it('should return 200 even if refresh token is missing (best-effort logout)', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
        body: {},
      });
      const res = MockResponse.create();

      // Act
      await controller.logout(req, res);

      // Assert — logout always succeeds, cookies are cleared regardless
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logged out successfully',
        })
      );
    });

    it('should return 200 even if refresh token not found (best-effort logout)', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
        body: { refreshToken: 'nonexistent-token' },
      });
      const res = MockResponse.create();

      mockAuthService.revokeRefreshToken.mockResolvedValue(false);

      // Act
      await controller.logout(req, res);

      // Assert — logout is best-effort, always succeeds
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logged out successfully',
        })
      );
    });
  });

  describe('logoutAll', () => {
    it('should successfully logout from all devices', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
      });
      const res = MockResponse.create();

      mockAuthService.revokeAllUserTokens.mockResolvedValue(3);

      // Act
      await controller.logoutAll(req, res);

      // Assert
      expect(mockAuthService.revokeAllUserTokens).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out from all devices successfully',
        tokensRevoked: 3,
      });
      // Verify cookies are cleared
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    });

    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      const req = MockRequest.create();
      const res = MockResponse.create();

      // Act
      await controller.logoutAll(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('not authenticated') }),
        })
      );
    });

    it('should handle zero tokens revoked', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
      });
      const res = MockResponse.create();

      mockAuthService.revokeAllUserTokens.mockResolvedValue(0);

      // Act
      await controller.logoutAll(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Logged out from all devices successfully',
        tokensRevoked: 0,
      });
      // Verify cookies are cleared even with zero tokens
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    });
  });

  describe('getActiveSessions', () => {
    it('should return list of active sessions', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
      });
      const res = MockResponse.create();

      const mockTokens = [
        {
          id: 'token-1',
          createdAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-01-08'),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        {
          id: 'token-2',
          createdAt: new Date('2024-01-02'),
          expiresAt: new Date('2024-01-09'),
          ipAddress: '192.168.1.2',
          userAgent: 'Chrome/120.0',
        },
      ];
      mockAuthService.getUserRefreshTokens.mockResolvedValue(mockTokens as any);

      // Act
      await controller.getActiveSessions(req, res);

      // Assert
      expect(mockAuthService.getUserRefreshTokens).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        sessions: [
          {
            id: 'token-1',
            createdAt: new Date('2024-01-01'),
            expiresAt: new Date('2024-01-08'),
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
          {
            id: 'token-2',
            createdAt: new Date('2024-01-02'),
            expiresAt: new Date('2024-01-09'),
            ipAddress: '192.168.1.2',
            userAgent: 'Chrome/120.0',
          },
        ],
      });
    });

    it('should return empty array if no active sessions', async () => {
      // Arrange
      const req = MockRequest.createAuth({
        user: { id: mockUser.id, username: mockUser.username, role: 'user' },
      });
      const res = MockResponse.create();

      mockAuthService.getUserRefreshTokens.mockResolvedValue([]);

      // Act
      await controller.getActiveSessions(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        sessions: [],
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      const req = MockRequest.create();
      const res = MockResponse.create();

      // Act
      await controller.getActiveSessions(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.stringContaining('not authenticated') }),
        })
      );
    });
  });

  describe('discordInitiate', () => {
    let mockDiscordService: any;

    beforeEach(() => {
      // Mock Discord service methods
      mockDiscordService = {
        generateAuthUrl: jest
          .fn()
          .mockReturnValue('https://discord.com/oauth2/authorize?client_id=test&state=test-state'),
      };

      // Mock the getDiscordService and isDiscordServiceInitialized functions
      const discordModule = require('../../services/discord/DiscordService');
      discordModule.getDiscordService = jest.fn().mockReturnValue(mockDiscordService);
      discordModule.isDiscordServiceInitialized = jest.fn().mockReturnValue(true);
    });

    it('should redirect to Discord OAuth URL when service is initialized', async () => {
      // Arrange
      const req = MockRequest.create({
        method: 'GET',
      });
      const res = MockResponse.create();
      res.redirect = jest.fn();

      // Act
      await controller.discordInitiate(req, res);

      // Assert — uses HMAC-signed state in URL (no cookie needed)
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://discord.com/oauth2/authorize')
      );
    });

    it('should redirect to frontend with error when Discord service not initialized', async () => {
      // Arrange
      const req = MockRequest.create({
        method: 'GET',
      });
      const res = MockResponse.create();
      res.redirect = jest.fn();

      // Mock Discord service as not initialized
      const discordModule = require('../../services/discord/DiscordService');
      discordModule.isDiscordServiceInitialized = jest.fn().mockReturnValue(false);

      // Act
      await controller.discordInitiate(req, res);

      // Assert
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/login?error=discord_not_configured')
      );
    });
  });

  describe('discordCallback', () => {
    let mockDiscordService: any;
    const backendRedirectUri = 'http://localhost:3000/api/v2/auth/discord/callback';

    beforeEach(() => {
      // Set environment variable for backend redirect URI
      process.env.DISCORD_REDIRECT_URI_BACKEND = backendRedirectUri;

      // Mock Discord service methods
      mockDiscordService = {
        authenticateUser: jest.fn(),
        getUserInfo: jest.fn(),
      };

      // Mock the getDiscordService and isDiscordServiceInitialized functions
      const discordModule = require('../../services/discord/DiscordService');
      discordModule.getDiscordService = jest.fn().mockReturnValue(mockDiscordService);
      discordModule.isDiscordServiceInitialized = jest.fn().mockReturnValue(true);
    });

    afterEach(() => {
      // Clean up environment variable
      delete process.env.DISCORD_REDIRECT_URI_BACKEND;
    });

    it('should return error when Discord service is not initialized', async () => {
      // Arrange
      const req = MockRequest.create({
        body: {
          code: 'auth-code-123',
          redirectUri: 'http://localhost:3001/login/callback',
        },
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
      });
      const res = MockResponse.create();

      // Mock Discord service as not initialized
      const discordModule = require('../../services/discord/DiscordService');
      discordModule.isDiscordServiceInitialized = jest.fn().mockReturnValue(false);

      // Act
      await controller.discordCallback(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Discord authentication is not available'),
          }),
        })
      );
    });

    it('should successfully authenticate with Discord and create new user', async () => {
      // Arrange
      const mockDiscordTokens = {
        access_token: 'discord-access-token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'discord-refresh-token',
        scope: 'identify email',
      };

      const mockDiscordUser = {
        id: 'discord-123',
        username: 'testdiscord',
        discriminator: '1234',
        avatar: 'avatar-hash',
        email: 'discord@example.com',
        verified: true,
      };

      const mockCreatedUser = {
        ...mockUser,
        id: 'new-user-id',
        discordId: 'discord-123',
        username: 'testdiscord',
        email: 'discord@example.com',
      };

      const mockTokens = {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 3600,
      };

      const req = MockRequest.create({
        body: {
          code: 'auth-code-123',
          redirectUri: 'http://localhost:3001/login/callback',
        },
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
      });
      const res = MockResponse.create();

      mockDiscordService.authenticateUser.mockResolvedValue(mockDiscordTokens);
      mockDiscordService.getUserInfo.mockResolvedValue(mockDiscordUser);
      mockUserService.getUserByDiscordId = jest.fn().mockResolvedValue(null);
      mockUserService.createUser = jest.fn().mockResolvedValue(mockCreatedUser);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      await controller.discordCallback(req, res);

      // Assert
      expect(mockDiscordService.authenticateUser).toHaveBeenCalledWith(
        'auth-code-123',
        backendRedirectUri
      );
      expect(mockDiscordService.getUserInfo).toHaveBeenCalledWith('discord-access-token');
      expect(mockUserService.getUserByDiscordId).toHaveBeenCalledWith('discord-123');
      expect(mockUserService.createUser).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        mockCreatedUser,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should successfully authenticate with Discord and login existing user', async () => {
      // Arrange
      const mockDiscordTokens = {
        access_token: 'discord-access-token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'discord-refresh-token',
        scope: 'identify email',
      };

      const mockDiscordUser = {
        id: 'discord-123',
        username: 'testdiscord',
        discriminator: '1234',
        avatar: 'avatar-hash',
        email: 'discord@example.com',
        verified: true,
      };

      const mockTokens = {
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 3600,
      };

      const req = MockRequest.create({
        body: {
          code: 'auth-code-123',
          redirectUri: 'http://localhost:3001/login/callback',
        },
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
      });
      const res = MockResponse.create();

      mockDiscordService.authenticateUser.mockResolvedValue(mockDiscordTokens);
      mockDiscordService.getUserInfo.mockResolvedValue(mockDiscordUser);
      mockUserService.getUserByDiscordId = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(mockUser);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      await controller.discordCallback(req, res);

      // Assert
      expect(mockDiscordService.authenticateUser).toHaveBeenCalledWith(
        'auth-code-123',
        backendRedirectUri
      );
      expect(mockDiscordService.getUserInfo).toHaveBeenCalledWith('discord-access-token');
      expect(mockUserService.getUserByDiscordId).toHaveBeenCalledWith('discord-123');
      expect(mockUserService.updateUser).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return error if Discord authentication fails', async () => {
      // Arrange
      const req = MockRequest.create({
        body: {
          code: 'invalid-code',
          redirectUri: 'http://localhost:3001/login/callback',
        },
      });
      const res = MockResponse.create();

      mockDiscordService.authenticateUser.mockRejectedValue(
        new Error('Invalid authorization code')
      );

      // Act
      await controller.discordCallback(req, res);

      // Assert
      // When authenticateUser throws an error, it's caught and returns 401 (UnauthorizedError)
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return error if code is missing', async () => {
      // Arrange
      const req = MockRequest.create({
        body: {
          redirectUri: 'http://localhost:3001/login',
          // code missing
        },
        query: {},
      });
      const res = MockResponse.create();

      // Act
      await controller.discordCallback(req, res);

      // Assert
      // Should return 400 (ValidationError) when code is missing
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should successfully authenticate with GET request from Discord redirect', async () => {
      // Arrange
      const mockDiscordTokens = {
        access_token: 'discord-access-token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'discord-refresh-token',
        scope: 'identify email',
      };

      const mockDiscordUser = {
        id: 'discord-456',
        username: 'discorduser',
        discriminator: '5678',
        avatar: 'avatar-hash-2',
        email: 'discord-get@example.com',
        verified: true,
      };

      const mockCreatedUser = {
        ...mockUser,
        id: 'new-user-id-2',
        discordId: 'discord-456',
        username: 'discorduser',
        email: 'discord-get@example.com',
      };

      const mockTokens = {
        accessToken: 'jwt-access-token-2',
        refreshToken: 'jwt-refresh-token-2',
        expiresIn: 3600,
      };

      // Simulate GET request from Discord with query parameters
      const req = MockRequest.create({
        query: {
          code: 'auth-code-456',
          state: 'random-state-string',
        },
        body: {}, // Empty body for GET request
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
      });
      const res = MockResponse.create();

      mockDiscordService.authenticateUser.mockResolvedValue(mockDiscordTokens);
      mockDiscordService.getUserInfo.mockResolvedValue(mockDiscordUser);
      mockUserService.getUserByDiscordId = jest.fn().mockResolvedValue(null);
      mockUserService.createUser = jest.fn().mockResolvedValue(mockCreatedUser);
      mockAuthService.generateTokens.mockResolvedValue(mockTokens);

      // Act
      await controller.discordCallback(req, res);

      // Assert
      // Controller now uses DISCORD_REDIRECT_URI_BACKEND from env instead of request
      expect(mockDiscordService.authenticateUser).toHaveBeenCalledWith(
        'auth-code-456',
        backendRedirectUri
      );
      expect(mockDiscordService.getUserInfo).toHaveBeenCalledWith('discord-access-token');
      expect(mockUserService.getUserByDiscordId).toHaveBeenCalledWith('discord-456');
      expect(mockUserService.createUser).toHaveBeenCalled();
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        mockCreatedUser,
        expect.objectContaining({
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
