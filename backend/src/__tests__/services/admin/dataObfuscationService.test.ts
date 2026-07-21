/**
 * DataObfuscationService Tests
 *
 * Tests for sensitive data obfuscation:
 * - AES-256-GCM encryption / decryption
 * - One-way hashing
 * - Partial masking (email, username, generic)
 * - Field-level obfuscation
 * - Object / array obfuscation
 * - Summary creation
 * - Metrics obfuscation
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/encryption', () => ({
  isValidEncryptionKeyFormat: jest.fn().mockReturnValue(true),
}));

import {
  DataObfuscationService,
  ObfuscationLevel,
} from '../../../services/admin/DataObfuscationService';

describe('DataObfuscationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // encrypt / decrypt
  // ------------------------------------------------------------------
  describe('encrypt & decrypt', () => {
    it('should encrypt and then decrypt back to the original plaintext', () => {
      const plaintext = 'UEE Navy classified intel on Vanduul movements';
      const encrypted = DataObfuscationService.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      // Format: iv:authTag:ciphertext
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = DataObfuscationService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'Star Citizen fleet roster';
      const enc1 = DataObfuscationService.encrypt(plaintext);
      const enc2 = DataObfuscationService.encrypt(plaintext);

      expect(enc1).not.toBe(enc2);
      // Both should decrypt to the same value
      expect(DataObfuscationService.decrypt(enc1)).toBe(plaintext);
      expect(DataObfuscationService.decrypt(enc2)).toBe(plaintext);
    });

    it('should throw on invalid encrypted data format', () => {
      expect(() => DataObfuscationService.decrypt('invalid-data')).toThrow(
        'Invalid encrypted data format'
      );
    });

    it('should reject encrypted data with invalid IV length', () => {
      const invalidIv = '00'; // 1 byte, expected 12 bytes
      const authTag = '11'.repeat(16);
      const ciphertext = 'ff';

      expect(() => DataObfuscationService.decrypt(`${invalidIv}:${authTag}:${ciphertext}`)).toThrow(
        'Invalid IV length'
      );
    });

    it('should reject encrypted data with short auth tag', () => {
      const iv = '00'.repeat(12);
      const shortAuthTag = '11'; // 1 byte, expected 16 bytes
      const ciphertext = 'ff';

      expect(() => DataObfuscationService.decrypt(`${iv}:${shortAuthTag}:${ciphertext}`)).toThrow(
        'Invalid auth tag length'
      );
    });

    it('should handle empty strings', () => {
      const encrypted = DataObfuscationService.encrypt('');
      const decrypted = DataObfuscationService.decrypt(encrypted);
      expect(decrypted).toBe('');
    });
  });

  // ------------------------------------------------------------------
  // hash
  // ------------------------------------------------------------------
  describe('hash', () => {
    it('should return a consistent 16-character hex string', () => {
      const hash = DataObfuscationService.hash('user-pilot-alpha');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should produce the same hash for the same input', () => {
      const h1 = DataObfuscationService.hash('org-uee-navy');
      const h2 = DataObfuscationService.hash('org-uee-navy');
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different inputs', () => {
      const h1 = DataObfuscationService.hash('org-uee-navy');
      const h2 = DataObfuscationService.hash('org-pirate-guild');
      expect(h1).not.toBe(h2);
    });
  });

  // ------------------------------------------------------------------
  // partialMask
  // ------------------------------------------------------------------
  describe('partialMask', () => {
    it('should mask email keeping first/last char of local part and full domain', () => {
      const masked = DataObfuscationService.partialMask('commander@uee.navy', 'email');
      expect(masked).toBe('c*******r@uee.navy');
    });

    it('should handle short email local part', () => {
      const masked = DataObfuscationService.partialMask('ab@uee.navy', 'email');
      expect(masked).toBe('a*@uee.navy');
    });

    it('should fallback to generic if email has no @', () => {
      const masked = DataObfuscationService.partialMask('nodomain', 'email');
      // generic masking for 8 chars: first 2 + 4 stars + last 2
      expect(masked).toBe('no****in');
    });

    it('should mask username keeping first 2 and last 2 chars', () => {
      const masked = DataObfuscationService.partialMask('PilotAlpha', 'username');
      // length 10: first 2 + 6 stars + last 2
      expect(masked).toBe('Pi******ha');
    });

    it('should mask short username (3 chars)', () => {
      const masked = DataObfuscationService.partialMask('Ace', 'username');
      expect(masked).toBe('A**');
    });

    it('should return [EMPTY] for empty values', () => {
      expect(DataObfuscationService.partialMask('', 'generic')).toBe('[EMPTY]');
    });

    it('should mask generic short values with all stars', () => {
      const masked = DataObfuscationService.partialMask('Hi', 'generic');
      expect(masked).toBe('**');
    });

    it('should mask generic longer values keeping first 2 and last 2', () => {
      const masked = DataObfuscationService.partialMask('FleetCommander', 'generic');
      expect(masked).toBe('Fl**********er');
    });
  });

  // ------------------------------------------------------------------
  // obfuscateField
  // ------------------------------------------------------------------
  describe('obfuscateField', () => {
    it('should return null/undefined as-is', () => {
      expect(DataObfuscationService.obfuscateField('email', null)).toBeNull();
      expect(DataObfuscationService.obfuscateField('email', undefined)).toBeUndefined();
    });

    it('should not obfuscate NONE-level fields', () => {
      expect(DataObfuscationService.obfuscateField('createdAt', '2025-01-01')).toBe('2025-01-01');
      expect(DataObfuscationService.obfuscateField('status', 'active')).toBe('active');
    });

    it('should partially mask email fields', () => {
      const result = DataObfuscationService.obfuscateField('email', 'commander@uee.navy');
      expect(result).toBe('c*******r@uee.navy');
    });

    it('should show username fields as-is (NONE level)', () => {
      const result = DataObfuscationService.obfuscateField('username', 'PilotAlpha');
      expect(result).toBe('PilotAlpha');
    });

    it('should fully redact password fields', () => {
      expect(DataObfuscationService.obfuscateField('password', 'secret123')).toBe('[REDACTED]');
      expect(DataObfuscationService.obfuscateField('apiKey', 'key-abc')).toBe('[REDACTED]');
      expect(DataObfuscationService.obfuscateField('token', 'jwt-xyz')).toBe('[REDACTED]');
    });

    it('should show userId and organizationId as-is (NONE level)', () => {
      const result = DataObfuscationService.obfuscateField('userId', 'pilot-alpha');
      expect(result).toBe('pilot-alpha');
    });

    it('should show [ENCRYPTED] for encrypted-level fields', () => {
      expect(DataObfuscationService.obfuscateField('description', 'fleet notes')).toBe(
        '[ENCRYPTED]'
      );
      expect(DataObfuscationService.obfuscateField('notes', 'private info')).toBe('[ENCRYPTED]');
    });

    it('should use custom ObfuscationConfig when provided', () => {
      const customConfig = { myField: ObfuscationLevel.FULL };
      expect(DataObfuscationService.obfuscateField('myField', 'value', customConfig)).toBe(
        '[REDACTED]'
      );
    });
  });

  // ------------------------------------------------------------------
  // obfuscateObject
  // ------------------------------------------------------------------
  describe('obfuscateObject', () => {
    it('should obfuscate all fields of a flat object', () => {
      const userRecord = {
        email: 'commander@uee.navy',
        password: 'topsecret',
        status: 'active',
        createdAt: '2025-01-01',
        userId: 'pilot-001',
      };

      const result = DataObfuscationService.obfuscateObject(userRecord);

      expect(result.email).toBe('c*******r@uee.navy');
      expect(result.password).toBe('[REDACTED]');
      expect(result.status).toBe('active');
      expect(result.createdAt).toBe('2025-01-01');
      expect(result.userId).toBe('pilot-001');
    });

    it('should recursively obfuscate nested objects', () => {
      const nested = {
        status: 'active',
        profile: {
          email: 'pilot@starcitizen.com',
          password: 'secret',
        },
      };

      const result = DataObfuscationService.obfuscateObject(nested);

      expect(result.status).toBe('active');
      expect((result.profile as any).email).toContain('*');
      expect((result.profile as any).password).toBe('[REDACTED]');
    });

    it('should handle arrays within obfuscateObject', () => {
      const items = [
        { email: 'a@b.com', status: 'active' },
        { email: 'c@d.com', status: 'inactive' },
      ];

      const result = DataObfuscationService.obfuscateObject(items as any);

      expect(Array.isArray(result)).toBe(true);
      expect((result as any)[0].email).toContain('*');
      expect((result as any)[1].status).toBe('inactive');
    });

    it('should return non-objects as-is', () => {
      expect(DataObfuscationService.obfuscateObject(null as any)).toBeNull();
      expect(DataObfuscationService.obfuscateObject(undefined as any)).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // obfuscateArray
  // ------------------------------------------------------------------
  describe('obfuscateArray', () => {
    it('should obfuscate each item in the array', () => {
      const items = [
        { email: 'alpha@uee.navy', status: 'active' },
        { email: 'bravo@uee.navy', status: 'inactive' },
      ];

      const result = DataObfuscationService.obfuscateArray(items);

      expect(result).toHaveLength(2);
      expect(result[0].email).toContain('*');
      expect(result[1].email).toContain('*');
      expect(result[0].status).toBe('active');
    });
  });

  // ------------------------------------------------------------------
  // createSummary
  // ------------------------------------------------------------------
  describe('createSummary', () => {
    it('should create a summary with type, size, hash, and masked preview', () => {
      const data = { fleet: 'Alpha Wing', ships: 12 };
      const summary = DataObfuscationService.createSummary(data);

      expect(summary.type).toBe('object');
      expect(summary.size).toBeGreaterThan(0);
      expect(summary.hash).toMatch(/^[0-9a-f]{16}$/);
      expect(summary.preview).toBeDefined();
    });

    it('should truncate preview for large data', () => {
      const largeData = { content: 'x'.repeat(200) };
      const summary = DataObfuscationService.createSummary(largeData);

      // The preview should be a masked version of a 53-char string ("..."-suffixed at 50+3)
      expect(summary.preview.length).toBeLessThanOrEqual(60);
    });
  });

  // ------------------------------------------------------------------
  // obfuscateMetrics
  // ------------------------------------------------------------------
  describe('obfuscateMetrics', () => {
    it('should preserve aggregate counts and obfuscate user breakdown', () => {
      const metrics = {
        totalUsers: 150,
        totalOrganizations: 5,
        totalActivities: 320,
        userBreakdown: [{ name: 'PilotAlpha', events: 42 }],
        topUsers: [
          { id: 'pilot-alpha', count: 42 },
          { id: 'pilot-bravo', count: 30 },
        ],
        dailyStats: [{ day: '2025-12-01', count: 10 }],
        errorRate: 0.02,
        errorCount: 5,
      };

      const result = DataObfuscationService.obfuscateMetrics(metrics);

      expect(result.totalUsers).toBe(150);
      expect(result.totalOrganizations).toBe(5);
      expect(result.totalActivities).toBe(320);
      expect(result.userBreakdown).toBe('AGGREGATED_DATA');
      expect(result.dailyStats).toEqual([{ day: '2025-12-01', count: 10 }]);
      expect(result.errorRate).toBe(0.02);

      // topUsers ids should be hashed
      const topUsers = result.topUsers as any[];
      expect(topUsers[0].id).toMatch(/^[0-9a-f]{16}$/);
      expect(topUsers[0].count).toBe(42);
    });

    it('should handle metrics without optional fields', () => {
      const metrics = {
        totalUsers: 10,
        totalOrganizations: 1,
        totalActivities: 5,
      };

      const result = DataObfuscationService.obfuscateMetrics(metrics);

      expect(result.totalUsers).toBe(10);
      expect(result.userBreakdown).toBeUndefined();
      expect(result.topUsers).toBeUndefined();
    });
  });
});
