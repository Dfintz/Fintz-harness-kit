import {
  decrypt,
  encrypt,
  hashValue,
  obfuscateEmail,
  obfuscateIP,
  obfuscateUserAgent,
  obfuscateUsername,
} from '../../utils/encryption';

describe('Encryption Utilities', () => {
  // Set a test encryption key
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-min-length-required-here';
  });

  afterAll(() => {
    if (originalKey) {
      process.env.ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'sensitive@email.com';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'test@example.com';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const encrypted = encrypt('');
      expect(encrypted).toBe('');

      const decrypted = decrypt('');
      expect(decrypted).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = 'test@example.com!@#$%^&*()';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'user@例え.com';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error on decryption with wrong data', () => {
      expect(() => {
        decrypt('invalid-encrypted-data');
      }).toThrow();
    });

    it('should reject truncated payloads that do not include a full auth tag segment', () => {
      // salt (32) + iv (16) + authTag (16) requires at least 64 bytes
      const truncatedPayload = Buffer.alloc(63, 1).toString('base64');

      expect(() => {
        decrypt(truncatedPayload);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('obfuscateEmail', () => {
    it('should obfuscate a standard email', () => {
      const obfuscated = obfuscateEmail('john.doe@example.com');
      expect(obfuscated).toBe('j***e@e***e.c***m');
    });

    it('should obfuscate short local parts', () => {
      expect(obfuscateEmail('ab@test.com')).toBe('a*@t***t.c***m');
      expect(obfuscateEmail('a@test.com')).toBe('*@t***t.c***m');
    });

    it('should handle invalid emails', () => {
      expect(obfuscateEmail('')).toBe('***');
      expect(obfuscateEmail('notanemail')).toBe('***');
    });

    it('should handle single character domain parts', () => {
      const obfuscated = obfuscateEmail('test@a.b');
      expect(obfuscated).toBe('t***t@a.b');
    });
  });

  describe('obfuscateIP', () => {
    it('should obfuscate IPv4 addresses', () => {
      expect(obfuscateIP('192.168.1.100')).toBe('192.168.***.***');
      expect(obfuscateIP('10.0.0.1')).toBe('10.0.***.***');
    });

    it('should obfuscate IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const obfuscated = obfuscateIP(ipv6);
      expect(obfuscated).toBe('2001:0db8:85a3:****:****:****:****:****');
    });

    it('should handle invalid IPs', () => {
      expect(obfuscateIP('')).toBe('***');
      expect(obfuscateIP('invalid')).toBe('***');
    });

    it('should handle short IPv4', () => {
      expect(obfuscateIP('192.168')).toBe('***');
    });
  });

  describe('obfuscateUsername', () => {
    it('should obfuscate standard usernames', () => {
      expect(obfuscateUsername('john_doe')).toBe('j***e');
      expect(obfuscateUsername('testuser123')).toBe('t***3');
    });

    it('should handle short usernames', () => {
      expect(obfuscateUsername('ab')).toBe('**');
      expect(obfuscateUsername('a')).toBe('*');
    });

    it('should handle empty username', () => {
      expect(obfuscateUsername('')).toBe('***');
    });
  });

  describe('obfuscateUserAgent', () => {
    it('should obfuscate Chrome user agent', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      expect(obfuscateUserAgent(ua)).toBe('Chrome/***');
    });

    it('should obfuscate Firefox user agent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      expect(obfuscateUserAgent(ua)).toBe('Firefox/***');
    });

    it('should obfuscate Safari user agent', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      expect(obfuscateUserAgent(ua)).toBe('Safari/***');
    });

    it('should handle unknown user agents', () => {
      expect(obfuscateUserAgent('UnknownBrowser/1.0')).toBe('Browser/***');
    });

    it('should handle empty user agent', () => {
      expect(obfuscateUserAgent('')).toBe('***');
    });
  });

  describe('hashValue', () => {
    it('should create consistent hash for same input', () => {
      const value = 'test-value';
      const hash1 = hashValue(value);
      const hash2 = hashValue(value);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(value);
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = hashValue('value1');
      const hash2 = hashValue('value2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      expect(hashValue('')).toBe('');
    });

    it('should create fixed length hash', () => {
      const hash1 = hashValue('short');
      const hash2 = hashValue('a very long string with lots of characters');

      expect(hash1.length).toBe(hash2.length);
      expect(hash1.length).toBe(64); // SHA-256 produces 64 hex characters
    });
  });
});
