import { GoogleOAuthService } from '../../../services/google/GoogleOAuthService';

// Save originals
const originalEnv = { ...process.env };

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.GOOGLE_REDIRECT_URI_BACKEND = 'http://localhost:3000/api/v2/auth/google/callback';
    service = new GoogleOAuthService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when all env vars are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when client ID is missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const unconfigured = new GoogleOAuthService();
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate a valid Google auth URL with state', () => {
      const url = service.generateAuthUrl('test-state-123');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-google-client-id');
      expect(url).toContain('state=test-state-123');
      expect(url).toContain('scope=openid+email+profile');
      expect(url).toContain('response_type=code');
    });

    it('should throw when state is empty', () => {
      expect(() => service.generateAuthUrl('')).toThrow('State parameter is required');
    });
  });

  describe('authenticateUser', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'google-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      } as Response);

      const result = await service.authenticateUser('test-code');
      expect(result.access_token).toBe('google-access-token');
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
        'Google authentication failed'
      );
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockUser = {
        id: '12345',
        email: 'test@gmail.com',
        verified_email: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response);

      const result = await service.getUserInfo('valid-token');
      expect(result.id).toBe('12345');
      expect(result.email).toBe('test@gmail.com');
    });

    it('should throw when access token is empty', async () => {
      await expect(service.getUserInfo('')).rejects.toThrow('Access token is required');
    });

    it('should throw on failed user info fetch', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Invalid token' }),
      } as Response);

      await expect(service.getUserInfo('bad-token')).rejects.toThrow(
        'Failed to fetch Google user info'
      );
    });
  });
});
