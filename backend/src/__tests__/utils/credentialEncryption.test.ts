/**
 * Tests for credentialEncryption utility
 * Covers encryption/decryption, legacy data handling, and error cases
 */

import {
  decryptAuthConfig,
  decryptCredential,
  encryptAuthConfig,
  encryptCredential,
} from '../../utils/credentialEncryption';

// Mock logger to avoid console spam during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('credentialEncryption', () => {
  // Set up test environment variable
  const originalEnv = process.env.CREDENTIAL_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
  });

  afterAll(() => {
    if (originalEnv) {
      process.env.CREDENTIAL_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    }
  });

  describe('encryptCredential / decryptCredential', () => {
    it('should encrypt and decrypt a credential correctly', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encryptCredential(plaintext);

      // Encrypted format should be iv:authTag:ciphertext
      expect(encrypted).toContain(':');
      expect(encrypted.split(':').length).toBe(3);
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      expect(encryptCredential('')).toBe('');
      expect(decryptCredential('')).toBe('');
    });

    it('should return legacy plaintext data without colons unchanged', () => {
      const legacy = 'plain-password-no-colons';
      const result = decryptCredential(legacy);
      expect(result).toBe(legacy);
    });

    it('should return legacy plaintext data with wrong part count unchanged', () => {
      const legacy = 'password:with:too:many:colons';
      const result = decryptCredential(legacy);
      expect(result).toBe(legacy);
    });

    it('should handle special characters in credentials', () => {
      const plaintext = 'p@ssw0rd!#$%^&*(){}[]|\\/<>?,.:;"\'`~';
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'пароль密码🔐';
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for malformed encrypted data with invalid auth tag length', () => {
      // Create a properly formatted but malformed payload with wrong auth tag
      const iv = Buffer.from('0123456789abcdef').toString('base64');
      const badAuthTag = Buffer.from('short').toString('base64'); // Wrong length
      const ciphertext = Buffer.from('encrypted').toString('base64');
      const malformed = `${iv}:${badAuthTag}:${ciphertext}`;

      expect(() => decryptCredential(malformed)).toThrow('Invalid auth tag length');
    });

    it('should throw error for malformed encrypted data with invalid IV length', () => {
      const badIv = Buffer.from('short-iv').toString('base64'); // Wrong length
      const authTag = Buffer.alloc(16, 1).toString('base64');
      const ciphertext = Buffer.from('encrypted').toString('base64');
      const malformed = `${badIv}:${authTag}:${ciphertext}`;

      expect(() => decryptCredential(malformed)).toThrow('Invalid IV length');
    });

    it('should throw error for encrypted data with wrong key', () => {
      const plaintext = 'secret';
      const encrypted = encryptCredential(plaintext);

      // Change the key
      const originalKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'different-key';

      expect(() => decryptCredential(encrypted)).toThrow();

      // Restore key
      process.env.CREDENTIAL_ENCRYPTION_KEY = originalKey;
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'same-password';
      const encrypted1 = encryptCredential(plaintext);
      const encrypted2 = encryptCredential(plaintext);

      // Different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decryptCredential(encrypted1)).toBe(plaintext);
      expect(decryptCredential(encrypted2)).toBe(plaintext);
    });
  });

  describe('encryptAuthConfig / decryptAuthConfig', () => {
    it('should encrypt and decrypt password field', () => {
      const config = {
        type: 'basic',
        username: 'admin',
        password: 'secret123',
      };

      const encrypted = encryptAuthConfig(config);
      expect(encrypted.password).not.toBe('secret123');
      expect(encrypted.username).toBe('admin'); // username not encrypted

      const decrypted = decryptAuthConfig(encrypted);
      expect(decrypted.password).toBe('secret123');
      expect(decrypted.username).toBe('admin');
    });

    it('should encrypt and decrypt token field', () => {
      const config = {
        type: 'bearer',
        token: 'bearer-token-xyz',
      };

      const encrypted = encryptAuthConfig(config);
      expect(encrypted.token).not.toBe('bearer-token-xyz');

      const decrypted = decryptAuthConfig(encrypted);
      expect(decrypted.token).toBe('bearer-token-xyz');
    });

    it('should encrypt and decrypt apiKey field', () => {
      const config = {
        type: 'apiKey',
        apiKey: 'api-key-123',
        apiKeyHeader: 'X-API-Key',
      };

      const encrypted = encryptAuthConfig(config);
      expect(encrypted.apiKey).not.toBe('api-key-123');
      expect(encrypted.apiKeyHeader).toBe('X-API-Key'); // header not encrypted

      const decrypted = decryptAuthConfig(encrypted);
      expect(decrypted.apiKey).toBe('api-key-123');
    });

    it('should encrypt OAuth2 clientSecret', () => {
      const config = {
        type: 'oauth2',
        oauth2Config: {
          clientId: 'public-client-id',
          clientSecret: 'secret-client-secret',
          tokenUrl: 'https://auth.example.com/token',
        },
      };

      const encrypted = encryptAuthConfig(config);
      const oauth2 = encrypted.oauth2Config as Record<string, unknown>;
      expect(oauth2.clientSecret).not.toBe('secret-client-secret');
      expect(oauth2.clientId).toBe('public-client-id'); // clientId not encrypted

      const decrypted = decryptAuthConfig(encrypted);
      const oauth2Decrypted = decrypted.oauth2Config as Record<string, unknown>;
      expect(oauth2Decrypted.clientSecret).toBe('secret-client-secret');
    });

    it('should handle null/undefined config', () => {
      expect(encryptAuthConfig(null as unknown as Record<string, unknown>)).toBeNull();
      expect(decryptAuthConfig(null as unknown as Record<string, unknown>)).toBeNull();
    });

    it('should handle config without sensitive fields', () => {
      const config = {
        type: 'none',
        metadata: { foo: 'bar' },
      };

      const encrypted = encryptAuthConfig(config);
      expect(encrypted).toEqual(config);

      const decrypted = decryptAuthConfig(encrypted);
      expect(decrypted).toEqual(config);
    });

    it('should handle multiple sensitive fields', () => {
      const config = {
        password: 'pass123',
        token: 'token456',
        apiKey: 'key789',
      };

      const encrypted = encryptAuthConfig(config);
      expect(encrypted.password).not.toBe('pass123');
      expect(encrypted.token).not.toBe('token456');
      expect(encrypted.apiKey).not.toBe('key789');

      const decrypted = decryptAuthConfig(encrypted);
      expect(decrypted.password).toBe('pass123');
      expect(decrypted.token).toBe('token456');
      expect(decrypted.apiKey).toBe('key789');
    });
  });
});
