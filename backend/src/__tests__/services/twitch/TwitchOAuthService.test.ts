import { TwitchOAuthService } from '../../../services/twitch/TwitchOAuthService';

// Save originals
const originalEnv = { ...process.env };

describe('TwitchOAuthService', () => {
  let service: TwitchOAuthService;

  beforeEach(() => {
    process.env.TWITCH_CLIENT_ID = 'test-twitch-client-id';
    process.env.TWITCH_CLIENT_SECRET = 'test-twitch-client-secret';
    process.env.TWITCH_REDIRECT_URI_BACKEND = 'http://localhost:3000/api/v2/auth/twitch/callback';
    service = new TwitchOAuthService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when all env vars are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when client secret is missing', () => {
      delete process.env.TWITCH_CLIENT_SECRET;
      const unconfigured = new TwitchOAuthService();
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate a valid Twitch auth URL with state', () => {
      const url = service.generateAuthUrl('test-state-456');
      expect(url).toContain('https://id.twitch.tv/oauth2/authorize');
      expect(url).toContain('client_id=test-twitch-client-id');
      expect(url).toContain('state=test-state-456');
      expect(url).toContain('scope=user%3Aread%3Aemail');
      expect(url).toContain('response_type=code');
    });

    it('should throw when state is empty', () => {
      expect(() => service.generateAuthUrl('')).toThrow('State parameter is required');
    });
  });

  describe('authenticateUser', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'twitch-access-token',
        token_type: 'bearer',
        expires_in: 14400,
        refresh_token: 'twitch-refresh',
        scope: ['user:read:email'],
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await service.authenticateUser('test-code');
      expect(result.access_token).toBe('twitch-access-token');
    });

    it('should throw when code is empty', async () => {
      await expect(service.authenticateUser('')).rejects.toThrow('Authorization code is required');
    });

    it('should throw on failed token exchange', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve(JSON.stringify({ error: 'invalid_grant' })),
      } as Response);

      await expect(service.authenticateUser('bad-code')).rejects.toThrow(
        'Twitch authentication failed'
      );
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockUser = {
        data: [
          {
            id: '67890',
            login: 'teststreamer',
            display_name: 'TestStreamer',
            email: 'test@twitch.tv',
            profile_image_url: 'https://example.com/avatar.jpg',
            type: '',
            broadcaster_type: 'affiliate',
          },
        ],
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      const result = await service.getUserInfo('valid-token');
      expect(result.id).toBe('67890');
      expect(result.login).toBe('teststreamer');
    });

    it('should include Client-Id header in request', async () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: '1',
                login: 'test',
                display_name: 'Test',
                type: '',
                broadcaster_type: '',
              },
            ],
          }),
      } as Response);

      await service.getUserInfo('token');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.twitch.tv/helix/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Client-Id': 'test-twitch-client-id',
          }),
        })
      );
    });

    it('should throw when access token is empty', async () => {
      await expect(service.getUserInfo('')).rejects.toThrow('Access token is required');
    });

    it('should throw when Twitch returns empty data', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await expect(service.getUserInfo('valid-token')).rejects.toThrow(
        'Twitch API returned empty user data'
      );
    });

    it('should throw on failed user info fetch', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid OAuth token' }),
      } as Response);

      await expect(service.getUserInfo('bad-token')).rejects.toThrow(
        'Failed to fetch Twitch user info'
      );
    });
  });
});
