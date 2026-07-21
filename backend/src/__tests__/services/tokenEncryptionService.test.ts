import crypto from 'crypto';

import { TokenEncryptionService, getTokenEncryptionService } from '../../services/security';
import logger from '../../utils/logger';

// Mock crypto module
jest.mock('crypto');

describe('TokenEncryptionService', () => {
  let tokenEncryptionService: TokenEncryptionService;
  let mockCipher: any;
  let mockDecipher: any;

  const createMockCipher = () => ({
    update: jest.fn().mockReturnValue('encrypted-part'),
    final: jest.fn().mockReturnValue('final-part'),
    // AES-GCM auth tags are 16 bytes; keep mock shape aligned with production.
    getAuthTag: jest.fn().mockReturnValue(Buffer.from('11'.repeat(16), 'hex')),
  });

  const createMockDecipher = () => ({
    update: jest.fn().mockReturnValue('decrypted-part'),
    final: jest.fn().mockReturnValue('final-part'),
    setAuthTag: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock crypto functions
    mockCipher = createMockCipher();
    mockDecipher = createMockDecipher();

    (crypto.randomBytes as jest.Mock) = jest.fn((size: number) => Buffer.alloc(size, 'x'));
    (crypto.scryptSync as jest.Mock) = jest.fn(() => Buffer.alloc(32, 'k'));
    (crypto.createCipheriv as jest.Mock) = jest.fn(() => mockCipher);
    (crypto.createDecipheriv as jest.Mock) = jest.fn(() => mockDecipher);

    // Set environment variables
    process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-secret-key';
    process.env.TOKEN_ENCRYPTION_SALT = 'token-encryption-salt';
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.TOKEN_ENCRYPTION_SALT;
  });

  describe('constructor', () => {
    it('should initialize with encryption key from environment', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'my-secret-key';

      const service = new TokenEncryptionService();

      expect(crypto.scryptSync).toHaveBeenCalledWith('my-secret-key', 'token-encryption-salt', 32);
      expect(service).toBeDefined();
    });

    it('should use random key when environment variable not set', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      const service = new TokenEncryptionService();

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(service).toBeDefined();
    });

    it('should log warning when using default key', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      new TokenEncryptionService();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('TOKEN_ENCRYPTION_KEY not set')
      );
    });

    it('should derive key using scrypt with salt', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key';

      new TokenEncryptionService();

      expect(crypto.scryptSync).toHaveBeenCalledWith('test-key', 'token-encryption-salt', 32);
    });

    it('should log initialization message', () => {
      new TokenEncryptionService();

      expect(logger.info).toHaveBeenCalledWith('TokenEncryptionService initialized');
    });
  });

  describe('encrypt', () => {
    beforeEach(() => {
      tokenEncryptionService = new TokenEncryptionService();
    });

    it('should encrypt a token successfully', () => {
      const token = 'my-secret-token';

      const result = tokenEncryptionService.encrypt(token);

      expect(result).toEqual({
        encrypted: 'encrypted-partfinal-part',
        iv: expect.any(String),
        authTag: expect.any(String),
      });
    });

    it('should generate random IV for each encryption', () => {
      const token = 'test-token';

      (crypto.randomBytes as jest.Mock) = jest
        .fn()
        .mockReturnValueOnce(Buffer.from('iv-1234567890123456'))
        .mockReturnValueOnce(Buffer.from('iv-abcdefghijklmnop'));

      tokenEncryptionService = new TokenEncryptionService();

      const result1 = tokenEncryptionService.encrypt(token);
      const result2 = tokenEncryptionService.encrypt(token);

      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should use AES-256-GCM algorithm', () => {
      const token = 'test-token';

      tokenEncryptionService.encrypt(token);

      expect(crypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer)
      );
    });

    it('should call cipher update with correct parameters', () => {
      const token = 'my-token';

      tokenEncryptionService.encrypt(token);

      expect(mockCipher.update).toHaveBeenCalledWith(token, 'utf8', 'hex');
    });

    it('should finalize cipher and get auth tag', () => {
      const token = 'test-token';

      tokenEncryptionService.encrypt(token);

      expect(mockCipher.final).toHaveBeenCalledWith('hex');
      expect(mockCipher.getAuthTag).toHaveBeenCalled();
    });

    it('should throw error on encryption failure', () => {
      mockCipher.update.mockImplementation(() => {
        throw new Error('Encryption error');
      });

      expect(() => tokenEncryptionService.encrypt('token')).toThrow('Failed to encrypt token');
    });

    it('should log error on encryption failure', () => {
      mockCipher.update.mockImplementation(() => {
        throw new Error('Cipher error');
      });

      try {
        tokenEncryptionService.encrypt('token');
      } catch (e) {
        // Expected
      }

      expect(logger.error).toHaveBeenCalledWith(
        'Token encryption failed',
        expect.objectContaining({ error: 'Cipher error' })
      );
    });

    it('should handle empty token', () => {
      const result = tokenEncryptionService.encrypt('');

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
    });

    it('should handle very long tokens', () => {
      const longToken = 'x'.repeat(10000);

      const result = tokenEncryptionService.encrypt(longToken);

      expect(result).toHaveProperty('encrypted');
      expect(mockCipher.update).toHaveBeenCalledWith(longToken, 'utf8', 'hex');
    });

    it('should handle tokens with special characters', () => {
      const specialToken = 'token!@#$%^&*()_+-={}[]|:";\'<>?,./`~';

      const result = tokenEncryptionService.encrypt(specialToken);

      expect(result).toHaveProperty('encrypted');
    });

    it('should handle tokens with unicode characters', () => {
      const unicodeToken = 'token-with-emoji-🚀-and-中文';

      const result = tokenEncryptionService.encrypt(unicodeToken);

      expect(result).toHaveProperty('encrypted');
      expect(mockCipher.update).toHaveBeenCalledWith(unicodeToken, 'utf8', 'hex');
    });
  });

  describe('decrypt', () => {
    const validIv = '00'.repeat(16);
    const validAuthTag = '11'.repeat(16);

    beforeEach(() => {
      tokenEncryptionService = new TokenEncryptionService();
    });

    it('should decrypt a token successfully', () => {
      const encrypted = 'encrypted-data';
      const iv = validIv;
      const authTag = validAuthTag;

      const result = tokenEncryptionService.decrypt(encrypted, iv, authTag);

      expect(result).toBe('decrypted-partfinal-part');
    });

    it('should use AES-256-GCM algorithm', () => {
      const encrypted = 'encrypted-data';
      const iv = validIv;
      const authTag = validAuthTag;

      tokenEncryptionService.decrypt(encrypted, iv, authTag);

      expect(crypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-gcm',
        expect.any(Buffer),
        expect.any(Buffer),
        { authTagLength: 16 }
      );
    });

    it('should set auth tag before decryption', () => {
      const encrypted = 'encrypted-data';
      const iv = validIv;
      const authTag = validAuthTag;

      tokenEncryptionService.decrypt(encrypted, iv, authTag);

      expect(mockDecipher.setAuthTag).toHaveBeenCalled();
    });

    it('should reject short auth tags before attempting decryption', () => {
      const encrypted = 'encrypted-data';
      const shortAuthTag = '11';

      expect(() => tokenEncryptionService.decrypt(encrypted, validIv, shortAuthTag)).toThrow(
        'Failed to decrypt token'
      );
      expect(crypto.createDecipheriv).not.toHaveBeenCalled();
    });

    it('should reject invalid IV length before attempting decryption', () => {
      const encrypted = 'encrypted-data';
      const shortIv = '00';

      expect(() => tokenEncryptionService.decrypt(encrypted, shortIv, validAuthTag)).toThrow(
        'Failed to decrypt token'
      );
      expect(crypto.createDecipheriv).not.toHaveBeenCalled();
    });

    it('should call decipher update with correct parameters', () => {
      const encrypted = 'encrypted-data';
      const iv = validIv;
      const authTag = validAuthTag;

      tokenEncryptionService.decrypt(encrypted, iv, authTag);

      expect(mockDecipher.update).toHaveBeenCalledWith(encrypted, 'hex', 'utf8');
    });

    it('should finalize decryption', () => {
      const encrypted = 'encrypted-data';
      const iv = validIv;
      const authTag = validAuthTag;

      tokenEncryptionService.decrypt(encrypted, iv, authTag);

      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
    });

    it('should throw error on decryption failure', () => {
      mockDecipher.update.mockImplementation(() => {
        throw new Error('Decryption error');
      });

      expect(() => tokenEncryptionService.decrypt('encrypted', validIv, validAuthTag)).toThrow(
        'Failed to decrypt token'
      );
    });

    it('should log error on decryption failure', () => {
      mockDecipher.update.mockImplementation(() => {
        throw new Error('Decipher error');
      });

      try {
        tokenEncryptionService.decrypt('encrypted', validIv, validAuthTag);
      } catch (e) {
        // Expected
      }

      expect(logger.error).toHaveBeenCalledWith(
        'Token decryption failed',
        expect.objectContaining({ error: 'Decipher error' })
      );
    });

    it('should handle invalid auth tag', () => {
      mockDecipher.setAuthTag.mockImplementation(() => {
        throw new Error('Invalid auth tag');
      });

      expect(() => tokenEncryptionService.decrypt('encrypted', validIv, validAuthTag)).toThrow(
        'Failed to decrypt token'
      );
    });

    it('should handle tampered encrypted data', () => {
      mockDecipher.final.mockImplementation(() => {
        throw new Error('Authentication failed');
      });

      expect(() => tokenEncryptionService.decrypt('tampered-data', validIv, validAuthTag)).toThrow(
        'Failed to decrypt token'
      );
    });

    it('should handle wrong IV', () => {
      mockDecipher.update.mockImplementation(() => {
        throw new Error('Bad decrypt');
      });

      expect(() =>
        tokenEncryptionService.decrypt('encrypted', '22'.repeat(16), validAuthTag)
      ).toThrow('Failed to decrypt token');
    });
  });

  describe('test', () => {
    beforeEach(() => {
      tokenEncryptionService = new TokenEncryptionService();
    });

    it('should return true when encryption/decryption works', () => {
      // Mock successful round-trip
      // The test() method generates: 'test-token-' + crypto.randomBytes(32).toString('hex')
      // Buffer.alloc(32, 'x') creates 32 bytes of value 0x78 (ASCII 'x')
      // .toString('hex') converts each byte to 2-char hex, so 0x78 → '78', repeated 32 times
      const expectedToken = `test-token-${'78'.repeat(32)}`;

      mockCipher.update.mockReturnValue('encrypted');
      mockCipher.final.mockReturnValue('');
      mockDecipher.update.mockReturnValue(expectedToken);
      mockDecipher.final.mockReturnValue('');

      const result = tokenEncryptionService.test();

      expect(result).toBe(true);
    });

    it('should return false when encryption fails', () => {
      mockCipher.update.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = tokenEncryptionService.test();

      expect(result).toBe(false);
    });

    it('should return false when decryption fails', () => {
      mockDecipher.update.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = tokenEncryptionService.test();

      expect(result).toBe(false);
    });

    it('should generate random test token', () => {
      tokenEncryptionService.test();

      expect(crypto.randomBytes).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('getTokenEncryptionService', () => {
    beforeEach(() => {
      // Reset singleton
      jest.resetModules();
      jest.clearAllMocks();
    });

    it('should return singleton instance', () => {
      // Setup mocks for successful test
      mockCipher = createMockCipher();
      mockDecipher = createMockDecipher();
      (crypto.createCipheriv as jest.Mock) = jest.fn(() => mockCipher);
      (crypto.createDecipheriv as jest.Mock) = jest.fn(() => mockDecipher);

      // The test() method generates: 'test-token-' + crypto.randomBytes(32).toString('hex')
      // Buffer.alloc(32, 'x') → 32 bytes of 0x78 → '78' repeated 32 times in hex
      const expectedToken = `test-token-${'78'.repeat(32)}`;
      mockCipher.update.mockReturnValue('encrypted');
      mockCipher.final.mockReturnValue('');
      mockDecipher.update.mockReturnValue(expectedToken);
      mockDecipher.final.mockReturnValue('');

      const service1 = getTokenEncryptionService();
      const service2 = getTokenEncryptionService();

      expect(service1).toBe(service2);
    });

    it('should test encryption on initialization', () => {
      // Setup for test to pass
      mockCipher = createMockCipher();
      mockDecipher = createMockDecipher();
      (crypto.createCipheriv as jest.Mock) = jest.fn(() => mockCipher);
      (crypto.createDecipheriv as jest.Mock) = jest.fn(() => mockDecipher);

      // The test() method generates: 'test-token-' + crypto.randomBytes(32).toString('hex')
      // Buffer.alloc(32, 'x') → 32 bytes of 0x78 → '78' repeated 32 times in hex
      const expectedToken = `test-token-${'78'.repeat(32)}`;
      mockCipher.update.mockReturnValue('encrypted');
      mockCipher.final.mockReturnValue('');
      mockDecipher.update.mockReturnValue(expectedToken);
      mockDecipher.final.mockReturnValue('');

      const service = getTokenEncryptionService();

      expect(service).toBeDefined();
    });

    it('should log error when encryption test fails but not throw', () => {
      // Isolate this test so singleton is fresh
      jest.isolateModules(() => {
        mockCipher.update.mockImplementation(() => {
          throw new Error('Test failed');
        });

        // Re-apply mocks for isolated modules
        const mockLogger = {
          debug: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
        };
        jest.doMock('../../utils/logger', () => ({
          __esModule: true,
          default: mockLogger,
          logger: mockLogger,
        }));

        const { getTokenEncryptionService } = require('../../services/security');

        // Should not throw, but should log error
        const service = getTokenEncryptionService();
        expect(service).toBeDefined();

        expect(mockLogger.error).toHaveBeenCalledWith('Token encryption service test failed!');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          '⚠️  Token encryption may not work correctly - server running in degraded mode'
        );
      });
    });
  });

  describe('Encryption/Decryption Round-trip', () => {
    beforeEach(() => {
      // Setup realistic crypto mocks for round-trip testing
      let encryptedData = '';
      let ivData = '';
      let authTagData = '';

      (crypto.createCipheriv as jest.Mock) = jest.fn(() => ({
        update: jest.fn((data: string) => {
          encryptedData = Buffer.from(data).toString('base64');
          return encryptedData;
        }),
        final: jest.fn(() => ''),
        getAuthTag: jest.fn(() => {
          authTagData = Buffer.from('auth-tag-1234567', 'utf8').toString('hex');
          return Buffer.from(authTagData, 'hex');
        }),
      }));

      (crypto.createDecipheriv as jest.Mock) = jest.fn(() => ({
        setAuthTag: jest.fn(),
        update: jest.fn(() => Buffer.from(encryptedData, 'base64').toString('utf8')),
        final: jest.fn(() => ''),
      }));

      (crypto.randomBytes as jest.Mock) = jest.fn((size: number) => {
        if (size === 16) {
          ivData = Buffer.from('test-iv-16-bytes').toString('hex');
          return Buffer.from(ivData, 'hex');
        }
        return Buffer.from('random-bytes'.repeat(Math.ceil(size / 12)).slice(0, size));
      });

      tokenEncryptionService = new TokenEncryptionService();
    });

    it('should successfully encrypt and decrypt a token', () => {
      const originalToken = 'my-secret-access-token';

      const { encrypted, iv, authTag } = tokenEncryptionService.encrypt(originalToken);
      const decrypted = tokenEncryptionService.decrypt(encrypted, iv, authTag);

      expect(decrypted).toBe(originalToken);
    });

    it('should handle multiple encrypt/decrypt cycles', () => {
      const tokens = ['token1', 'token2', 'token3'];

      tokens.forEach(token => {
        const { encrypted, iv, authTag } = tokenEncryptionService.encrypt(token);
        const decrypted = tokenEncryptionService.decrypt(encrypted, iv, authTag);
        expect(decrypted).toBe(token);
      });
    });
  });

  describe('Security & Edge Cases', () => {
    beforeEach(() => {
      tokenEncryptionService = new TokenEncryptionService();
    });

    it('should use different IV for identical tokens', () => {
      const token = 'same-token';

      (crypto.randomBytes as jest.Mock) = jest
        .fn()
        .mockReturnValueOnce(Buffer.from('iv1-xxxxxxxxxxxx'))
        .mockReturnValueOnce(Buffer.from('iv2-yyyyyyyyyyyy'));

      tokenEncryptionService = new TokenEncryptionService();

      const result1 = tokenEncryptionService.encrypt(token);
      const result2 = tokenEncryptionService.encrypt(token);

      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should handle null bytes in token', () => {
      const tokenWithNull = 'token\x00with\x00nulls';

      const result = tokenEncryptionService.encrypt(tokenWithNull);

      expect(result).toHaveProperty('encrypted');
    });

    it('should use 256-bit key', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'test-key';

      new TokenEncryptionService();

      expect(crypto.scryptSync).toHaveBeenCalledWith(
        'test-key',
        'token-encryption-salt',
        32 // 256 bits / 8
      );
    });

    it('should use 16-byte IV', () => {
      tokenEncryptionService.encrypt('test');

      expect(crypto.randomBytes).toHaveBeenCalledWith(16); // 128 bits / 8
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
