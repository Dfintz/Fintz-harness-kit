// Unmock DiscordService to test the real implementation
jest.unmock('../../services/discord/DiscordService');

import { DiscordService } from '../../services/discord/DiscordService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock Discord.js Client
jest.mock('discord.js', () => ({
    Client: jest.fn().mockImplementation(() => ({
        login: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        once: jest.fn(),
        isReady: jest.fn().mockReturnValue(true),
        user: { tag: 'TestBot#1234' },
    })),
    GatewayIntentBits: { Guilds: 1, GuildMembers: 2, GuildMessages: 4, MessageContent: 8 },
    Partials: { Message: 'Message', Channel: 'Channel', Reaction: 'Reaction' },
}));

describe('DiscordService (SSO)', () => {
    let discordService: DiscordService;
    const mockBotToken = 'test-bot-token';
    const mockClientId = 'test-client-id';
    const mockClientSecret = 'test-client-secret';
    const mockRedirectUri = 'http://localhost:3000/auth/discord/callback';

    beforeEach(() => {
        discordService = new DiscordService(mockBotToken, mockClientId, mockClientSecret, mockRedirectUri);
        mockFetch.mockClear();
    });

    describe('constructor', () => {
        it('should create a service instance with valid parameters', () => {
            expect(discordService).toBeInstanceOf(DiscordService);
        });

        it('should throw error if clientId is missing', () => {
            expect(() => new DiscordService(mockBotToken, '', mockClientSecret, mockRedirectUri))
                .toThrow('Discord SSO requires clientId, clientSecret, and redirectUri');
        });

        it('should throw error if clientSecret is missing', () => {
            expect(() => new DiscordService(mockBotToken, mockClientId, '', mockRedirectUri))
                .toThrow('Discord SSO requires clientId, clientSecret, and redirectUri');
        });

        it('should throw error if redirectUri is missing', () => {
            expect(() => new DiscordService(mockBotToken, mockClientId, mockClientSecret, ''))
                .toThrow('Discord SSO requires clientId, clientSecret, and redirectUri');
        });

        it('should throw error if all parameters are missing', () => {
            expect(() => new DiscordService('', '', '', ''))
                .toThrow('Discord bot token is required');
        });
    });

    describe('generateAuthUrl', () => {
        it('should generate valid Discord OAuth2 URL with state parameter', () => {
            const state = 'random-csrf-token';
            const url = discordService.generateAuthUrl(state);

            expect(url).toContain('https://discord.com/api/oauth2/authorize');
            expect(url).toContain(`client_id=${mockClientId}`);
            expect(url).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
            expect(url).toContain('response_type=code');
            expect(url).toContain('scope=identify+email');
            expect(url).toContain(`state=${state}`);
        });

        it('should throw error if state parameter is missing', () => {
            expect(() => discordService.generateAuthUrl(''))
                .toThrow('State parameter is required for CSRF protection');
        });

        it('should generate different URLs for different state values', () => {
            const url1 = discordService.generateAuthUrl('state1');
            const url2 = discordService.generateAuthUrl('state2');

            expect(url1).not.toBe(url2);
            expect(url1).toContain('state=state1');
            expect(url2).toContain('state=state2');
        });
    });

    describe('authenticateUser', () => {
        const mockCode = 'discord-auth-code';
        const mockTokenResponse = {
            access_token: 'mock-access-token',
            token_type: 'Bearer',
            expires_in: 604800,
            refresh_token: 'mock-refresh-token',
            scope: 'identify email'
        };

        it('should successfully exchange code for tokens', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockTokenResponse,
            });

            const result = await discordService.authenticateUser(mockCode);

            expect(result).toEqual(mockTokenResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://discord.com/api/oauth2/token',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                })
            );
        });

        it('should throw error if code is missing', async () => {
            await expect(discordService.authenticateUser(''))
                .rejects.toThrow('Authorization code is required');
        });

        it('should throw error on failed authentication', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                text: async () => JSON.stringify({ error: 'invalid_grant' }),
                json: async () => ({ error: 'invalid_grant' }),
            });

            await expect(discordService.authenticateUser(mockCode))
                .rejects.toThrow('Discord authentication failed: 400 - invalid_grant');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(discordService.authenticateUser(mockCode))
                .rejects.toThrow('Failed to authenticate user: Network error');
        });

        it('should handle malformed JSON response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Invalid JSON response',
                json: async () => { throw new Error('Invalid JSON'); },
            });

            await expect(discordService.authenticateUser(mockCode))
                .rejects.toThrow('Discord authentication failed: 500');
        });

        it('should send correct request parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockTokenResponse,
            });

            await discordService.authenticateUser(mockCode);

            const fetchCall = mockFetch.mock.calls[0];
            const body = fetchCall[1].body.toString();

            expect(body).toContain(`client_id=${mockClientId}`);
            expect(body).toContain(`client_secret=${mockClientSecret}`);
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain(`code=${mockCode}`);
            expect(body).toContain(`redirect_uri=${encodeURIComponent(mockRedirectUri)}`);
        });
    });

    describe('getUserInfo', () => {
        const mockAccessToken = 'mock-access-token';
        const mockUserInfo = {
            id: '123456789',
            username: 'TestUser',
            discriminator: '0001',
            avatar: 'avatar-hash',
            email: 'test@example.com',
            verified: true,
        };

        it('should successfully fetch user information', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockUserInfo,
            });

            const result = await discordService.getUserInfo(mockAccessToken);

            expect(result).toEqual(mockUserInfo);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://discord.com/api/users/@me',
                expect.objectContaining({
                    headers: {
                        Authorization: `Bearer ${mockAccessToken}`,
                    },
                })
            );
        });

        it('should throw error if access token is missing', async () => {
            await expect(discordService.getUserInfo(''))
                .rejects.toThrow('Access token is required');
        });

        it('should throw error on failed API request', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({ message: 'Invalid access token' }),
            });

            await expect(discordService.getUserInfo(mockAccessToken))
                .rejects.toThrow('Failed to fetch user info: 401 - Invalid access token');
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(discordService.getUserInfo(mockAccessToken))
                .rejects.toThrow('Failed to fetch user info: Network error');
        });

        it('should handle rate limiting', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                json: async () => ({ message: 'Rate limited' }),
            });

            await expect(discordService.getUserInfo(mockAccessToken))
                .rejects.toThrow('Failed to fetch user info: 429 - Rate limited');
        });
    });

    describe('refreshAccessToken', () => {
        const mockRefreshToken = 'mock-refresh-token';
        const mockNewTokenResponse = {
            access_token: 'new-access-token',
            token_type: 'Bearer',
            expires_in: 604800,
            refresh_token: 'new-refresh-token',
            scope: 'identify email'
        };

        it('should successfully refresh access token', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockNewTokenResponse,
            });

            const result = await discordService.refreshAccessToken(mockRefreshToken);

            expect(result).toEqual(mockNewTokenResponse);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://discord.com/api/oauth2/token',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                })
            );
        });

        it('should throw error if refresh token is missing', async () => {
            await expect(discordService.refreshAccessToken(''))
                .rejects.toThrow('Refresh token is required');
        });

        it('should throw error on failed token refresh', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                json: async () => ({ error: 'invalid_grant' }),
            });

            await expect(discordService.refreshAccessToken(mockRefreshToken))
                .rejects.toThrow('Token refresh failed: 400 - invalid_grant');
        });

        it('should send correct request parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockNewTokenResponse,
            });

            await discordService.refreshAccessToken(mockRefreshToken);

            const fetchCall = mockFetch.mock.calls[0];
            const body = fetchCall[1].body.toString();

            expect(body).toContain(`client_id=${mockClientId}`);
            expect(body).toContain(`client_secret=${mockClientSecret}`);
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain(`refresh_token=${mockRefreshToken}`);
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

            await expect(discordService.refreshAccessToken(mockRefreshToken))
                .rejects.toThrow('Failed to refresh access token: Connection timeout');
        });
    });

    describe('shouldRefreshToken', () => {
        it('should return true if token expires within 24 hours', () => {
            const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours from now
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(true);
        });

        it('should return true if token expires exactly in 24 hours', () => {
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(true);
        });

        it('should return false if token expires more than 24 hours from now', () => {
            const expiresAt = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours from now
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(false);
        });

        it('should return true if token is already expired', () => {
            const expiresAt = new Date(Date.now() - 1000); // 1 second ago
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(true);
        });

        it('should return true for tokens expiring in 1 hour', () => {
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(true);
        });

        it('should return false for tokens expiring in 48 hours', () => {
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(false);
        });
    });

    describe('revokeToken', () => {
        const mockAccessToken = 'token-to-revoke';

        it('should successfully revoke access token', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            await expect(discordService.revokeToken(mockAccessToken)).resolves.not.toThrow();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://discord.com/api/oauth2/token/revoke',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                })
            );
        });

        it('should throw error if access token is missing', async () => {
            await expect(discordService.revokeToken(''))
                .rejects.toThrow('Access token is required');
        });

        it('should throw error on failed token revocation', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
            });

            await expect(discordService.revokeToken(mockAccessToken))
                .rejects.toThrow('Failed to revoke token: 400');
        });

        it('should send correct request parameters', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            await discordService.revokeToken(mockAccessToken);

            const fetchCall = mockFetch.mock.calls[0];
            const body = fetchCall[1].body.toString();

            expect(body).toContain(`client_id=${mockClientId}`);
            expect(body).toContain(`client_secret=${mockClientSecret}`);
            expect(body).toContain(`token=${mockAccessToken}`);
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network failure'));

            await expect(discordService.revokeToken(mockAccessToken))
                .rejects.toThrow('Failed to revoke token: Network failure');
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete OAuth flow', async () => {
            // 1. Generate auth URL
            const state = 'csrf-token-123';
            const authUrl = discordService.generateAuthUrl(state);
            expect(authUrl).toContain('state=csrf-token-123');

            // 2. Authenticate user
            const mockCode = 'auth-code';
            const mockTokens = {
                access_token: 'access-123',
                refresh_token: 'refresh-123',
                expires_in: 604800,
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockTokens,
            });

            const tokens = await discordService.authenticateUser(mockCode);
            expect(tokens.access_token).toBe('access-123');

            // 3. Get user info
            const mockUser = { id: '123', username: 'TestUser' };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockUser,
            });

            const userInfo = await discordService.getUserInfo(tokens.access_token);
            expect(userInfo.username).toBe('TestUser');
        });

        it('should handle token refresh scenario', async () => {
            // Token is about to expire
            const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
            expect(discordService.shouldRefreshToken(expiresAt)).toBe(true);

            // Refresh the token
            const newTokens = {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                expires_in: 604800,
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => newTokens,
            });

            const refreshed = await discordService.refreshAccessToken('old-refresh-token');
            expect(refreshed.access_token).toBe('new-access-token');
        });

        it('should handle logout scenario', async () => {
            // Revoke token on logout
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            await expect(discordService.revokeToken('user-token'))
                .resolves.not.toThrow();
        });
    });

    describe('Error handling edge cases', () => {
        it('should handle undefined error responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => '',
                json: async () => { throw new Error(); },
            });

            await expect(discordService.authenticateUser('code'))
                .rejects.toThrow('Discord authentication failed: 500');
        });

        it('should handle empty error responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 502,
                statusText: 'Bad Gateway',
                json: async () => ({}),
            });

            await expect(discordService.getUserInfo('token'))
                .rejects.toThrow('Failed to fetch user info: 502 - Bad Gateway');
        });

        it('should preserve original error messages', async () => {
            const customError = new Error('Custom network error');
            mockFetch.mockRejectedValueOnce(customError);

            await expect(discordService.refreshAccessToken('token'))
                .rejects.toThrow('Failed to refresh access token: Custom network error');
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
