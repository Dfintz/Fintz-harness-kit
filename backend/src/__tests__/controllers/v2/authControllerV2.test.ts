/**
 * AuthControllerV2 Unit Tests
 * Tests v2 authentication endpoints with standardized response format
 */

import { Request, Response } from 'express';
import { AuthController as AuthControllerV1 } from '../../../controllers/authController';
import { AuthControllerV2 } from '../../../controllers/v2/authController';
import { ApiErrorCode } from '../../../types/api';

// Mock the v1 controller (still used for OAuth methods + devLogin)
jest.mock('../../../controllers/authController');

// Mock services used directly by V2 controller
jest.mock('../../../services/authentication', () => ({
  AuthenticationService: jest.fn().mockImplementation(() => ({
    generateTokens: jest.fn(),
    refreshTokens: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    getUserRefreshTokens: jest.fn(),
  })),
}));
jest.mock('../../../services/security', () => ({
  AccountSecurityService: {
    getInstance: jest.fn().mockReturnValue({
      recordFailedAttempt: jest.fn(),
      isAccountLocked: jest.fn().mockReturnValue(false),
      getLockoutStatus: jest.fn(),
      resetFailedAttempts: jest.fn(),
    }),
  },
}));
jest.mock('../../../services/security/access/AccountAccessLogService', () => ({
  AccountAccessLogService: jest.fn().mockImplementation(() => ({
    logAccess: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../../config/cookies', () => ({
  getAccessTokenCookieOptions: jest.fn().mockReturnValue({ httpOnly: true, secure: true }),
  refreshTokenCookieOptions: { httpOnly: true, secure: true },
  clearCookieOptions: { httpOnly: true },
  clearRefreshCookieOptions: { httpOnly: true },
  clearCsrfCookieOptions: { httpOnly: true },
  pkceCookieOptions: { httpOnly: true, secure: true },
  COOKIE_NAMES: {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    CSRF_TOKEN: 'csrf_token',
    DISCORD_PKCE_VERIFIER: 'discord_pkce_verifier',
    MOBILE_REDIRECT: 'mobile_redirect',
  },
}));
jest.mock('../../../middleware/sessionBinding', () => ({
  createSessionBinding: jest.fn().mockReturnValue('session-binding'),
}));
jest.mock('../../../services/discord/DiscordService', () => ({
  isDiscordServiceInitialized: jest.fn().mockReturnValue(true),
  getDiscordService: jest.fn(),
}));
jest.mock('../../../config/urls', () => ({
  getFrontendUrl: jest.fn().mockReturnValue('http://localhost:3001'),
}));
jest.mock('../../../utils/oauthState', () => ({
  generateOAuthState: jest.fn().mockReturnValue('mock-state'),
  getOAuthSecret: jest.fn().mockReturnValue('mock-secret'),
  validateOAuthState: jest.fn().mockReturnValue({ valid: true }),
}));

function createJwtToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.signature`;
}

function createJsonResponse(payload: Record<string, unknown>): globalThis.Response {
  return new globalThis.Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AuthControllerV2', () => {
  let controller: AuthControllerV2;
  let mockV1Controller: jest.Mocked<AuthControllerV1>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Create mock response with v2 helpers
    mockResponse = {
      success: jest.fn(),
      error: jest.fn(),
      redirect: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    // Create controller
    controller = new AuthControllerV2();
    mockV1Controller = (controller as any).v1Controller;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    let mockUserService: any;
    let mockSecurityService: any;
    let mockAuthService: any;

    beforeEach(() => {
      mockUserService = (controller as any).userService;
      mockSecurityService = (controller as any).securityService;
      mockAuthService = (controller as any).authService;
    });

    it('should return v2 formatted response on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        role: 'user',
        activeOrgId: null,
      };

      mockRequest.body = { username: 'testuser', password: 'password123' };

      mockUserService.validateCredentials = jest.fn().mockResolvedValue(mockUser);
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          user: { id: 'user-123', username: 'testuser', role: 'user' },
        })
      );
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should return v2 error format on invalid credentials', async () => {
      mockRequest.body = { username: 'testuser', password: 'wrongpassword' };

      mockUserService.validateCredentials = jest.fn().mockResolvedValue(null);
      mockUserService.getUserByUsername = jest.fn().mockResolvedValue(null);

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_CREDENTIALS,
        'Invalid credentials',
        undefined,
        401
      );
    });

    it('should return error when credentials are missing', async () => {
      mockRequest.body = {};

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_INPUT,
        'Username and password are required',
        undefined,
        400
      );
    });

    it('should handle exceptions with v2 error format', async () => {
      mockRequest.body = { username: 'testuser', password: 'password123' };
      mockUserService.validateCredentials = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INTERNAL_ERROR,
        'Database connection failed',
        undefined,
        500
      );
    });
  });

  describe('sandboxLogin', () => {
    const originalEnableSandboxLogin = process.env.ENABLE_SANDBOX_LOGIN;
    const originalSandboxLoginPrefix = process.env.SANDBOX_LOGIN_PREFIX;
    const originalSandboxEmailDomain = process.env.SANDBOX_EMAIL_DOMAIN;

    let mockUserService: any;
    let mockSecurityService: any;
    let mockAuthService: any;

    beforeEach(() => {
      delete process.env.ENABLE_SANDBOX_LOGIN;
      delete process.env.SANDBOX_LOGIN_PREFIX;
      delete process.env.SANDBOX_EMAIL_DOMAIN;

      mockUserService = (controller as any).userService;
      mockSecurityService = (controller as any).securityService;
      mockAuthService = (controller as any).authService;
    });

    afterEach(() => {
      process.env.ENABLE_SANDBOX_LOGIN = originalEnableSandboxLogin;
      process.env.SANDBOX_LOGIN_PREFIX = originalSandboxLoginPrefix;
      process.env.SANDBOX_EMAIL_DOMAIN = originalSandboxEmailDomain;
    });

    it('should return forbidden when sandbox login is disabled', async () => {
      await controller.sandboxLogin(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.FORBIDDEN,
        expect.stringContaining('Sandbox login is disabled'),
        undefined,
        403
      );
    });

    it('should return internal error when a non-forbidden error is thrown while enabled', async () => {
      process.env.ENABLE_SANDBOX_LOGIN = 'true';

      const mockUserServiceForError = (controller as any).userService;
      mockUserServiceForError.createSandboxUser = jest
        .fn()
        .mockRejectedValue(new Error('DB connection lost'));

      await controller.sandboxLogin(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INTERNAL_ERROR,
        expect.stringContaining('internal error'),
        undefined,
        500
      );
    });

    it('should create a sandbox user and issue tokens when enabled', async () => {
      process.env.ENABLE_SANDBOX_LOGIN = 'true';
      process.env.SANDBOX_LOGIN_PREFIX = 'Trial@User';
      process.env.SANDBOX_EMAIL_DOMAIN = 'Sandbox.Local';

      mockUserService.createSandboxUser = jest.fn().mockResolvedValue({
        id: 'sandbox-user-id',
        username: 'trialuser-123abc',
        role: 'user',
      });
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        accessToken: 'sandbox-access-token',
        refreshToken: 'sandbox-refresh-token',
      });
      mockSecurityService.resetFailedAttempts = jest.fn().mockResolvedValue(undefined);

      await controller.sandboxLogin(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.createSandboxUser).toHaveBeenCalledWith(
        expect.objectContaining({
          usernamePrefix: 'Trial@User',
          emailDomain: 'Sandbox.Local',
          ipAddress: '127.0.0.1',
        })
      );
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sandbox-user-id',
          role: 'user',
        }),
        expect.objectContaining({
          sessionBinding: 'session-binding',
        })
      );
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          sandbox: true,
          accessToken: 'sandbox-access-token',
          refreshToken: 'sandbox-refresh-token',
          user: expect.objectContaining({ id: 'sandbox-user-id', role: 'user' }),
        })
      );
    });
  });

  describe('logout', () => {
    let mockAuthService: any;

    beforeEach(() => {
      mockAuthService = (controller as any).authService;
    });

    it('should return v2 formatted response on successful logout', async () => {
      mockRequest.body = { refreshToken: 'refresh-token-123' };
      mockAuthService.revokeRefreshToken = jest.fn().mockResolvedValue(undefined);

      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('refresh-token-123');
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
      expect(mockResponse.success).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });

    it('should succeed even without refresh token', async () => {
      mockRequest.body = {};

      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
      expect(mockResponse.success).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });

  describe('logoutAll', () => {
    let mockAuthService: any;

    beforeEach(() => {
      mockAuthService = (controller as any).authService;
    });

    it('should logout all sessions and return v2 response', async () => {
      (mockRequest as any).user = { id: 'user-123' };
      mockAuthService.revokeAllUserTokens = jest.fn().mockResolvedValue(3);

      await controller.logoutAll(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({ tokensRevoked: 3 })
      );
    });

    it('should return error when not authenticated', async () => {
      await controller.logoutAll(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    });
  });

  describe('refresh', () => {
    let mockAuthService: any;

    beforeEach(() => {
      mockAuthService = (controller as any).authService;
    });

    it('should refresh tokens and return v2 formatted response', async () => {
      mockRequest.body = { refreshToken: 'old-refresh-token' };
      mockAuthService.refreshTokens = jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await controller.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should return error when refresh token is missing', async () => {
      mockRequest.body = {};

      await controller.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_INPUT,
        'Refresh token is required',
        undefined,
        400
      );
    });

    it('should handle expired refresh tokens with v2 error format', async () => {
      mockRequest.body = { refreshToken: 'expired-token' };
      mockAuthService.refreshTokens = jest.fn().mockRejectedValue(new Error('Token expired'));

      await controller.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.TOKEN_EXPIRED,
        'Invalid or expired refresh token',
        undefined,
        401
      );
    });
  });

  describe('getActiveSessions', () => {
    let mockAuthService: any;

    beforeEach(() => {
      mockAuthService = (controller as any).authService;
    });

    it('should return active sessions in v2 format', async () => {
      const sessions = [
        {
          id: 'session-1',
          createdAt: new Date('2025-12-07T10:00:00Z'),
          expiresAt: new Date('2025-12-14T10:00:00Z'),
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        },
      ];

      (mockRequest as any).user = { id: 'user-123' };
      mockAuthService.getUserRefreshTokens = jest.fn().mockResolvedValue(sessions);

      await controller.getActiveSessions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalledWith({
        sessions: [expect.objectContaining({ id: 'session-1', ipAddress: '192.168.1.1' })],
      });
    });

    it('should return error when not authenticated', async () => {
      await controller.getActiveSessions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        undefined,
        401
      );
    });

    it('should handle errors when fetching sessions', async () => {
      (mockRequest as any).user = { id: 'user-123' };
      mockAuthService.getUserRefreshTokens = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await controller.getActiveSessions(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INTERNAL_ERROR,
        'Database error',
        undefined,
        500
      );
    });
  });

  describe('discordCallback', () => {
    it('should handle Discord OAuth error in query params', async () => {
      mockRequest.query = { error: 'access_denied' };
      // POST method — returns V2 error
      mockRequest.method = 'POST';

      await controller.discordCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_CREDENTIALS,
        expect.stringContaining('access_denied'),
        undefined,
        401
      );
    });
  });

  describe('azureADCallback', () => {
    const originalAzureTenantId = process.env.AZURE_AD_TENANT_ID;
    const originalAzureClientId = process.env.AZURE_AD_CLIENT_ID;
    const originalAzureClientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const originalAzureAdminGroupIds = process.env.AZURE_AD_ADMIN_GROUP_IDS;

    beforeEach(() => {
      process.env.AZURE_AD_TENANT_ID = 'tenant-allowed';
      process.env.AZURE_AD_CLIENT_ID = 'azure-client-id';
      process.env.AZURE_AD_CLIENT_SECRET = 'azure-client-secret';
      process.env.AZURE_AD_ADMIN_GROUP_IDS = 'group-admin';
    });

    afterEach(() => {
      process.env.AZURE_AD_TENANT_ID = originalAzureTenantId;
      process.env.AZURE_AD_CLIENT_ID = originalAzureClientId;
      process.env.AZURE_AD_CLIENT_SECRET = originalAzureClientSecret;
      process.env.AZURE_AD_ADMIN_GROUP_IDS = originalAzureAdminGroupIds;
      jest.restoreAllMocks();
    });

    it('should return error when code or redirectUri missing', async () => {
      mockRequest.body = {};

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.INVALID_INPUT,
        'Code and redirectUri are required',
        undefined,
        400
      );
    });

    it('should return error when redirectUri origin is not allowed', async () => {
      mockRequest.body = {
        code: 'azure-code-123',
        redirectUri: 'https://evil.com/admin/login',
      };

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.FORBIDDEN,
        'Redirect URI is not allowed',
        undefined,
        403
      );
    });

    it('should reject users outside allowed admin groups', async () => {
      const accessToken = createJwtToken({ tid: 'tenant-allowed', groups: ['group-viewer'] });
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createJsonResponse({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email User.Read',
        })
      );

      mockRequest.body = {
        code: 'azure-code-123',
        redirectUri: 'http://localhost:3001/admin/login',
      };

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.FORBIDDEN,
        'Azure AD account is not in an allowed admin group',
        undefined,
        403
      );
    });

    it('should reject Azure AD login when no linked admin account exists', async () => {
      const mockUserService = (controller as any).userService;
      const accessToken = createJwtToken({ tid: 'tenant-allowed', groups: ['group-admin'] });

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          createJsonResponse({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email User.Read',
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 'graph-user-id',
            userPrincipalName: 'admin@example.com',
            displayName: 'Admin User',
          })
        );

      mockUserService.getUserByEmail = jest.fn().mockResolvedValue(null);

      mockRequest.body = {
        code: 'azure-code-123',
        redirectUri: 'http://localhost:3001/admin/login',
      };

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.FORBIDDEN,
        'No linked admin account exists for this Azure AD user',
        undefined,
        403
      );
    });

    it('should reject Azure AD login when linked account is not admin', async () => {
      const mockUserService = (controller as any).userService;
      const accessToken = createJwtToken({ tid: 'tenant-allowed', groups: ['group-admin'] });

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          createJsonResponse({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email User.Read',
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 'graph-user-id',
            userPrincipalName: 'member@example.com',
            displayName: 'Member User',
          })
        );

      mockUserService.getUserByEmail = jest.fn().mockResolvedValue({
        id: 'user-123',
        username: 'member-user',
        role: 'user',
      });

      mockRequest.body = {
        code: 'azure-code-123',
        redirectUri: 'http://localhost:3001/admin/login',
      };

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalledWith(
        ApiErrorCode.FORBIDDEN,
        'User account is not authorized for admin login',
        undefined,
        403
      );
    });

    it('should resolve admin group membership across paginated Graph responses', async () => {
      const mockUserService = (controller as any).userService;
      const mockAuthService = (controller as any).authService;
      const accessToken = createJwtToken({ tid: 'tenant-allowed' });

      const fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          createJsonResponse({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email User.Read',
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            value: [{ id: 'group-other' }],
            '@odata.nextLink':
              'https://graph.microsoft.com/v1.0/me/memberOf?$select=id&$skiptoken=abc',
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            value: [{ id: 'group-admin' }],
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 'graph-user-id',
            userPrincipalName: 'admin@example.com',
            displayName: 'Admin User',
          })
        );

      mockUserService.getUserByEmail = jest.fn().mockResolvedValue({
        id: 'admin-123',
        username: 'admin-user',
        displayName: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
      });
      mockUserService.updateUser = jest.fn().mockResolvedValue(true);
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });

      mockRequest.body = {
        code: 'azure-code-123',
        redirectUri: 'http://localhost:3001/admin/login',
      };

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect(fetchSpy.mock.calls[1]?.[0]).toEqual(expect.stringContaining('/memberOf'));
      expect(fetchSpy.mock.calls[2]?.[0]).toEqual(expect.stringContaining('/memberOf'));
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Azure AD authentication successful',
        })
      );
    });

    it('should allow linked admin user in allowed tenant and group', async () => {
      const mockUserService = (controller as any).userService;
      const mockAuthService = (controller as any).authService;
      const accessToken = createJwtToken({ tid: 'tenant-allowed', groups: ['group-admin'] });

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          createJsonResponse({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email User.Read',
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 'graph-user-id',
            userPrincipalName: 'admin@example.com',
            displayName: 'Admin User',
          })
        );

      mockUserService.getUserByEmail = jest.fn().mockResolvedValue({
        id: 'admin-123',
        username: 'admin-user',
        displayName: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
      });
      mockUserService.updateUser = jest.fn().mockResolvedValue(true);
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });

      mockRequest.body = {
        code: 'azure-code-123',
        redirectUri: 'http://localhost:3001/admin/login',
      };

      await controller.azureADCallback(mockRequest as Request, mockResponse as Response);

      expect(mockUserService.updateUser).toHaveBeenCalledWith(
        'admin-123',
        expect.objectContaining({
          lastLoginIp: '127.0.0.1',
        })
      );
      expect(mockResponse.success).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Azure AD authentication successful',
          user: expect.objectContaining({ role: 'admin' }),
        })
      );
    });
  });

  describe('v2 response format validation', () => {
    it('should always include metadata in success responses', async () => {
      const mockUserService = (controller as any).userService;
      const mockAuthService = (controller as any).authService;
      const mockSecurityService = (controller as any).securityService;

      mockRequest.body = { username: 'testuser', password: 'password123' };
      mockUserService.validateCredentials = jest.fn().mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        role: 'user',
        activeOrgId: null,
      });
      mockSecurityService.isAccountLocked = jest.fn().mockReturnValue(false);
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
      });

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.success).toHaveBeenCalled();
      const callArgs = (mockResponse.success as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toHaveProperty('accessToken', 'token-123');
    });

    it('should use ApiErrorCode enum for error codes', async () => {
      const mockAuthService = (controller as any).authService;
      mockRequest.body = { refreshToken: 'expired-token' };
      mockAuthService.refreshTokens = jest.fn().mockRejectedValue(new Error('Token expired'));

      await controller.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalled();
      const callArgs = (mockResponse.error as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(ApiErrorCode.TOKEN_EXPIRED);
    });

    it('should handle missing credentials gracefully', async () => {
      mockRequest.body = {};

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.error).toHaveBeenCalled();
      const callArgs = (mockResponse.error as jest.Mock).mock.calls[0];
      expect(callArgs[3]).toBe(400);
    });
  });

  describe('Cookie Handling', () => {
    it('should set cookies during login', async () => {
      const mockUserService = (controller as any).userService;
      const mockAuthService = (controller as any).authService;
      const mockSecurityService = (controller as any).securityService;

      mockRequest.body = { username: 'testuser', password: 'password123' };
      mockUserService.validateCredentials = jest.fn().mockResolvedValue({
        id: 'user-123',
        username: 'testuser',
        role: 'user',
        activeOrgId: null,
      });
      mockSecurityService.isAccountLocked = jest.fn().mockReturnValue(false);
      mockAuthService.generateTokens = jest.fn().mockResolvedValue({
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
      });

      await controller.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'token-123',
        expect.objectContaining({ httpOnly: true })
      );
    });

    it('should clear cookies during logout', async () => {
      const mockAuthService = (controller as any).authService;
      mockRequest.body = { refreshToken: 'refresh-123' };
      mockAuthService.revokeRefreshToken = jest.fn().mockResolvedValue(undefined);

      await controller.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(3);
    });

    it('should set cookies during token refresh', async () => {
      const mockAuthService = (controller as any).authService;

      mockRequest.body = {
        refreshToken: 'old-refresh-token',
      };

      mockAuthService.refreshTokens = jest.fn().mockResolvedValue({
        accessToken: 'new-token-456',
        refreshToken: 'new-refresh-456',
      });

      await controller.refresh(mockRequest as Request, mockResponse as Response);

      // Verify cookies were set with the new tokens
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'new-token-456',
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-456',
        expect.objectContaining({ httpOnly: true })
      );
    });
  });

  describe('2FA Management', () => {
    let mockTwoFactorService: any;
    let mockUserService: any;
    let mockUserAuthService: any;

    beforeEach(() => {
      mockTwoFactorService = {
        generateSecret: jest.fn(),
        verifyToken: jest.fn(),
        checkLockout: jest.fn(),
        trackFailedAttempt: jest.fn(),
        resetFailedAttempts: jest.fn(),
        hashBackupCodes: jest.fn(),
      };
      mockUserService = {
        getUserById: jest.fn(),
        updateUser: jest.fn(),
      };
      mockUserAuthService = {
        getUserWithPassword: jest.fn(),
        verifyPassword: jest.fn(),
      };

      (controller as any).twoFactorService = mockTwoFactorService;
      (controller as any).userService = mockUserService;
      (controller as any).userAuthService = mockUserAuthService;
    });

    describe('enable2FA', () => {
      it('should generate 2FA secret and backup codes', async () => {
        mockRequest = {
          user: { id: 'user-123', username: 'testuser' },
        };

        const mockSetup = {
          secret: 'JBSWY3DPEHPK3PXP',
          qrCodeUrl: 'data:image/png;base64,mock-qr-code',
          backupCodes: ['ABC123', 'DEF456'],
        };

        mockUserService.getUserById.mockResolvedValue({ id: 'user-123', twoFactorEnabled: false });
        mockTwoFactorService.generateSecret.mockResolvedValue(mockSetup);
        mockTwoFactorService.hashBackupCodes.mockReturnValue(['HASH1', 'HASH2']);
        mockUserService.updateUser.mockResolvedValue(true);

        await controller.enable2FA(mockRequest as any, mockResponse as Response);

        expect(mockTwoFactorService.generateSecret).toHaveBeenCalledWith(
          'testuser',
          'SC Fleet Manager'
        );
        expect(mockUserService.updateUser).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            twoFactorSecret: mockSetup.secret,
            backupCodes: ['HASH1', 'HASH2'],
          })
        );
        expect(mockResponse.success).toHaveBeenCalledWith(
          expect.objectContaining({
            secret: mockSetup.secret,
            qrCodeUrl: mockSetup.qrCodeUrl,
            backupCodes: expect.arrayContaining(['ABC123', 'DEF456']),
          })
        );
      });

      it('should handle errors during 2FA setup', async () => {
        mockRequest = {
          user: { id: 'user-123', username: 'testuser' },
        };

        mockUserService.getUserById.mockResolvedValue({ id: 'user-123', twoFactorEnabled: false });
        mockTwoFactorService.generateSecret.mockRejectedValue(new Error('Setup failed'));

        await controller.enable2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INTERNAL_ERROR,
          'Setup failed',
          undefined,
          500
        );
      });
    });

    describe('verify2FA', () => {
      it('should verify valid 2FA code and enable 2FA', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { code: '123456' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          twoFactorEnabled: false,
        };

        mockUserService.getUserById.mockResolvedValue(mockUser);
        mockTwoFactorService.checkLockout.mockResolvedValue({ isLocked: false });
        mockTwoFactorService.verifyToken.mockReturnValue(true);
        mockUserService.updateUser.mockResolvedValue(true);

        await controller.verify2FA(mockRequest as any, mockResponse as Response);

        expect(mockTwoFactorService.verifyToken).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
        expect(mockUserService.updateUser).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            twoFactorEnabled: true,
          })
        );
        expect(mockResponse.success).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining('verified successfully') })
        );
      });

      it('should normalize code (trim and uppercase)', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { code: '  abc123  ' }, // Backup code with whitespace
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'SECRET',
          twoFactorEnabled: false,
        };

        mockUserService.getUserById.mockResolvedValue(mockUser);
        mockTwoFactorService.checkLockout.mockResolvedValue({ isLocked: false });
        mockTwoFactorService.verifyToken.mockReturnValue(true);

        await controller.verify2FA(mockRequest as any, mockResponse as Response);

        expect(mockTwoFactorService.verifyToken).toHaveBeenCalledWith('SECRET', 'ABC123');
      });

      it('should reject invalid code and track failed attempt', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { code: '000000' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          twoFactorEnabled: false,
        };

        mockUserService.getUserById.mockResolvedValue(mockUser);
        mockTwoFactorService.checkLockout.mockResolvedValue({ isLocked: false });
        mockTwoFactorService.verifyToken.mockReturnValue(false);
        mockTwoFactorService.trackFailedAttempt.mockResolvedValue(undefined);

        await controller.verify2FA(mockRequest as any, mockResponse as Response);

        expect(mockTwoFactorService.trackFailedAttempt).toHaveBeenCalledWith('user-123');
        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INVALID_CREDENTIALS,
          expect.stringContaining('Invalid verification code'),
          expect.any(Object),
          401
        );
      });

      it('should reject when user is locked out', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { code: '123456' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        };

        mockUserService.getUserById.mockResolvedValue(mockUser);
        mockTwoFactorService.checkLockout.mockResolvedValue({
          isLocked: true,
          lockoutEndsAt: new Date(Date.now() + 15 * 60 * 1000),
          attemptsRemaining: 0,
        });

        await controller.verify2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          expect.stringContaining('locked'),
          expect.any(Object),
          429
        );
      });

      it('should validate code length (6 digits or 8 chars)', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { code: '12345' }, // Too short
        };

        await controller.verify2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INVALID_INPUT,
          expect.stringContaining('Invalid code format'),
          undefined,
          400
        );
      });
    });

    describe('disable2FA', () => {
      it('should disable 2FA with valid password and code', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { password: 'password123', code: '123456' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          twoFactorEnabled: true,
          password: 'hashed-password',
        };

        mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
        mockUserAuthService.verifyPassword.mockResolvedValue(true);
        mockTwoFactorService.verifyToken.mockReturnValue(true);
        mockUserService.updateUser.mockResolvedValue(true);

        await controller.disable2FA(mockRequest as any, mockResponse as Response);

        expect(mockUserAuthService.verifyPassword).toHaveBeenCalledWith(
          'password123',
          'hashed-password'
        );
        expect(mockTwoFactorService.verifyToken).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
        expect(mockUserService.updateUser).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            twoFactorEnabled: false,
            twoFactorSecret: undefined,
            backupCodes: [],
            failedTwoFactorAttempts: 0,
            twoFactorLockedUntil: undefined,
          })
        );
        expect(mockResponse.success).toHaveBeenCalled();
      });

      it('should normalize code before verification', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { password: 'password123', code: '  abc123  ' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'SECRET',
          twoFactorEnabled: true,
          password: 'hashed-password',
        };

        mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
        mockUserAuthService.verifyPassword.mockResolvedValue(true);
        mockTwoFactorService.verifyToken.mockReturnValue(true);

        await controller.disable2FA(mockRequest as any, mockResponse as Response);

        expect(mockTwoFactorService.verifyToken).toHaveBeenCalledWith('SECRET', 'ABC123');
      });

      it('should reject invalid password', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { password: 'wrongpassword', code: '123456' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          twoFactorEnabled: true,
          password: 'hashed-password',
        };

        mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
        mockUserAuthService.verifyPassword.mockResolvedValue(false);

        await controller.disable2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INVALID_CREDENTIALS,
          'Invalid password',
          undefined,
          401
        );
      });

      it('should reject invalid 2FA code', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { password: 'password123', code: '000000' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          twoFactorEnabled: true,
          password: 'hashed-password',
        };

        mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);
        mockUserAuthService.verifyPassword.mockResolvedValue(true);
        mockTwoFactorService.verifyToken.mockReturnValue(false);

        await controller.disable2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INVALID_CREDENTIALS,
          'Invalid 2FA code',
          undefined,
          401
        );
      });

      it('should reject when 2FA is not enabled', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { password: 'password123', code: '123456' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorEnabled: false,
          password: 'hashed-password',
        };

        mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);

        await controller.disable2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INVALID_INPUT,
          '2FA is not enabled',
          undefined,
          400
        );
      });

      it('should handle users without password', async () => {
        mockRequest = {
          user: { id: 'user-123' },
          body: { password: 'password123', code: '123456' },
        };

        const mockUser = {
          id: 'user-123',
          twoFactorEnabled: true,
          password: null, // OAuth user
        };

        mockUserAuthService.getUserWithPassword.mockResolvedValue(mockUser);

        await controller.disable2FA(mockRequest as any, mockResponse as Response);

        expect(mockResponse.error).toHaveBeenCalledWith(
          ApiErrorCode.INVALID_INPUT,
          expect.stringContaining('password is required'),
          undefined,
          400
        );
      });
    });
  });
});
