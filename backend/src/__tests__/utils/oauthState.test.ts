import { generateOAuthState, validateOAuthState } from '../../utils/oauthState';

describe('oauthState', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-oauth-state';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('generateOAuthState', () => {
    it('should generate a state with three dot-separated parts', () => {
      const state = generateOAuthState();
      const parts = state.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should generate unique states on each call', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      expect(state1).not.toBe(state2);
    });

    it('should include a hex nonce as first part', () => {
      const state = generateOAuthState();
      const nonce = state.split('.')[0];
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate a state with four parts when linkUserId is provided', () => {
      const state = generateOAuthState('user-123');
      const parts = state.split('.');
      expect(parts).toHaveLength(4);
    });
  });

  describe('validateOAuthState', () => {
    it('should validate a freshly generated state', () => {
      const state = generateOAuthState();
      const result = validateOAuthState(state);
      expect(result.valid).toBe(true);
      expect(result.linkUserId).toBeUndefined();
    });

    it('should reject undefined state', () => {
      expect(validateOAuthState(undefined).valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateOAuthState('').valid).toBe(false);
    });

    it('should reject malformed state (wrong number of parts)', () => {
      expect(validateOAuthState('only-one-part').valid).toBe(false);
      expect(validateOAuthState('two.parts').valid).toBe(false);
      expect(validateOAuthState('way.too.many.parts.here').valid).toBe(false);
    });

    it('should reject state with tampered signature', () => {
      const state = generateOAuthState();
      const parts = state.split('.');
      const tampered = `${parts[0]}.${parts[1]}.${'a'.repeat(parts[2].length)}`;
      expect(validateOAuthState(tampered).valid).toBe(false);
    });

    it('should reject expired state (>10 minutes)', () => {
      // Manually craft a state with an old timestamp
      const crypto = require('node:crypto');
      const nonce = crypto.randomBytes(16).toString('hex');
      const oldTimestamp = (Date.now() - 11 * 60 * 1000).toString(36);
      const payload = `${nonce}.${oldTimestamp}`;
      const secret = process.env.JWT_SECRET!;
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const expiredState = `${payload}.${signature}`;

      expect(validateOAuthState(expiredState).valid).toBe(false);
    });

    it('should accept state within 10-minute window', () => {
      // Manually craft a state with a recent timestamp (5 minutes ago)
      const crypto = require('node:crypto');
      const nonce = crypto.randomBytes(16).toString('hex');
      const recentTimestamp = (Date.now() - 5 * 60 * 1000).toString(36);
      const payload = `${nonce}.${recentTimestamp}`;
      const secret = process.env.JWT_SECRET!;
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const validState = `${payload}.${signature}`;

      expect(validateOAuthState(validState).valid).toBe(true);
    });

    it('should validate a state with linkUserId and return the userId', () => {
      const state = generateOAuthState('user-abc-123');
      const result = validateOAuthState(state);
      expect(result.valid).toBe(true);
      expect(result.linkUserId).toBe('user-abc-123');
    });

    it('should reject a link state with tampered userId', () => {
      const state = generateOAuthState('user-abc-123');
      const parts = state.split('.');
      // Tamper the userId part (index 2), keep signature (index 3)
      const tamperedUserId = Buffer.from('evil-user').toString('base64url');
      const tampered = `${parts[0]}.${parts[1]}.${tamperedUserId}.${parts[3]}`;
      expect(validateOAuthState(tampered).valid).toBe(false);
    });

    it('should not return linkUserId for states without one', () => {
      const state = generateOAuthState();
      const result = validateOAuthState(state);
      expect(result.valid).toBe(true);
      expect(result.linkUserId).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
