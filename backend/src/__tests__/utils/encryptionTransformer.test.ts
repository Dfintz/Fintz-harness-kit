import { decrypt, encrypt } from '../../utils/encryption';
import {
  encryptionTransformer,
  conditionalEncryptionTransformer,
  resolveDecryptedDisplayText,
} from '../../utils/encryptionTransformer';

describe('Encryption Transformers', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalEnabled = process.env.ENCRYPTION_ENABLED;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-min-length-required-here';
  });

  afterAll(() => {
    if (originalKey) {
      process.env.ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }

    if (originalEnabled) {
      process.env.ENCRYPTION_ENABLED = originalEnabled;
    } else {
      delete process.env.ENCRYPTION_ENABLED;
    }
  });

  describe('resolveDecryptedDisplayText', () => {
    const placeholder = '[Encrypted message \u2013 unavailable]';

    it('returns short plaintext unchanged', () => {
      expect(resolveDecryptedDisplayText('Partnership inquiry')).toBe('Partnership inquiry');
    });

    it('returns long human text (with spaces) unchanged', () => {
      const text = 'This is a fairly long human-written subject line about a partnership proposal';
      expect(resolveDecryptedDisplayText(text)).toBe(text);
    });

    it('returns empty string for null, undefined, and empty', () => {
      expect(resolveDecryptedDisplayText(null)).toBe('');
      expect(resolveDecryptedDisplayText(undefined)).toBe('');
      expect(resolveDecryptedDisplayText('')).toBe('');
    });

    it('recovers a value that is still an encrypted envelope', () => {
      const plaintext = 'Recruitment: interested in joining';
      const envelope = encrypt(plaintext);
      expect(resolveDecryptedDisplayText(envelope)).toBe(plaintext);
    });

    it('returns a placeholder for an undecryptable envelope', () => {
      const undecryptable = Buffer.alloc(80, 7).toString('base64');
      expect(resolveDecryptedDisplayText(undecryptable)).toBe(placeholder);
    });
  });

  describe('encryptionTransformer', () => {
    it('should encrypt value when saving to database', () => {
      const plaintext = 'sensitive@email.com';
      const encrypted = encryptionTransformer.to(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toBeTruthy();
    });

    it('should decrypt value when loading from database', () => {
      const plaintext = 'sensitive@email.com';
      const encrypted = encryptionTransformer.to(plaintext) as string;
      const decrypted = encryptionTransformer.from(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle null values', () => {
      expect(encryptionTransformer.to(null)).toBeNull();
      expect(encryptionTransformer.from(null)).toBeNull();
    });

    it('should handle undefined values', () => {
      expect(encryptionTransformer.to(undefined)).toBeUndefined();
      expect(encryptionTransformer.from(undefined)).toBeUndefined();
    });

    it('should handle empty strings', () => {
      expect(encryptionTransformer.to('')).toBe('');
      expect(encryptionTransformer.from('')).toBe('');
    });

    it('should produce different encrypted values for same plaintext', () => {
      const plaintext = 'test@example.com';
      const encrypted1 = encryptionTransformer.to(plaintext);
      const encrypted2 = encryptionTransformer.to(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encryptionTransformer.from(encrypted1)).toBe(plaintext);
      expect(encryptionTransformer.from(encrypted2)).toBe(plaintext);
    });

    it('should handle roundtrip encryption/decryption', () => {
      const testValues = [
        'user@example.com',
        'test123',
        'special!@#$%^&*()',
        'unicode例え',
        'a'.repeat(1000),
      ];

      testValues.forEach(value => {
        const encrypted = encryptionTransformer.to(value) as string;
        const decrypted = encryptionTransformer.from(encrypted);
        expect(decrypted).toBe(value);
      });
    });
  });

  describe('conditionalEncryptionTransformer', () => {
    beforeEach(() => {
      delete process.env.ENCRYPTION_ENABLED;
    });

    it('should not encrypt when ENCRYPTION_ENABLED is not set', () => {
      const plaintext = 'test@example.com';
      const result = conditionalEncryptionTransformer.to(plaintext);

      expect(result).toBe(plaintext);
    });

    it('should not decrypt when ENCRYPTION_ENABLED is not set', () => {
      const plaintext = 'test@example.com';
      const result = conditionalEncryptionTransformer.from(plaintext);

      expect(result).toBe(plaintext);
    });

    it('should encrypt when ENCRYPTION_ENABLED is true', () => {
      process.env.ENCRYPTION_ENABLED = 'true';

      const plaintext = 'test@example.com';
      const encrypted = conditionalEncryptionTransformer.to(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toBeTruthy();
    });

    it('should decrypt when ENCRYPTION_ENABLED is true', () => {
      process.env.ENCRYPTION_ENABLED = 'true';

      const plaintext = 'test@example.com';
      const encrypted = conditionalEncryptionTransformer.to(plaintext) as string;
      const decrypted = conditionalEncryptionTransformer.from(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle null values regardless of encryption setting', () => {
      process.env.ENCRYPTION_ENABLED = 'true';
      expect(conditionalEncryptionTransformer.to(null)).toBeNull();
      expect(conditionalEncryptionTransformer.from(null)).toBeNull();

      process.env.ENCRYPTION_ENABLED = 'false';
      expect(conditionalEncryptionTransformer.to(null)).toBeNull();
      expect(conditionalEncryptionTransformer.from(null)).toBeNull();
    });

    it('should handle undefined values regardless of encryption setting', () => {
      process.env.ENCRYPTION_ENABLED = 'true';
      expect(conditionalEncryptionTransformer.to(undefined)).toBeUndefined();
      expect(conditionalEncryptionTransformer.from(undefined)).toBeUndefined();

      process.env.ENCRYPTION_ENABLED = 'false';
      expect(conditionalEncryptionTransformer.to(undefined)).toBeUndefined();
      expect(conditionalEncryptionTransformer.from(undefined)).toBeUndefined();
    });

    it('should handle empty strings regardless of encryption setting', () => {
      process.env.ENCRYPTION_ENABLED = 'true';
      expect(conditionalEncryptionTransformer.to('')).toBe('');
      expect(conditionalEncryptionTransformer.from('')).toBe('');

      process.env.ENCRYPTION_ENABLED = 'false';
      expect(conditionalEncryptionTransformer.to('')).toBe('');
      expect(conditionalEncryptionTransformer.from('')).toBe('');
    });

    it('should not encrypt when ENCRYPTION_ENABLED is false', () => {
      process.env.ENCRYPTION_ENABLED = 'false';

      const plaintext = 'test@example.com';
      const result = conditionalEncryptionTransformer.to(plaintext);

      expect(result).toBe(plaintext);
    });

    it('should handle roundtrip with encryption enabled', () => {
      process.env.ENCRYPTION_ENABLED = 'true';

      const plaintext = 'user@example.com';
      const encrypted = conditionalEncryptionTransformer.to(plaintext) as string;
      const decrypted = conditionalEncryptionTransformer.from(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
