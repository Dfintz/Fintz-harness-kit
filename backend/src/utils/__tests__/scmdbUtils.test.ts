import { isValidScmdbUrl, normalizeScmdbUrl, parseScmdbMissionUrl } from '../scmdbUtils';

describe('scmdbUtils', () => {
  describe('parseScmdbMissionUrl', () => {
    describe('valid URLs', () => {
      it('should extract ID from full SCMDB URL with locale', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/en/contracts/ABC123')).toBe('ABC123');
      });

      it('should extract ID from SCMDB URL without locale', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/contracts/XYZ789')).toBe('XYZ789');
      });

      it('should extract ID from http (non-https) URL', () => {
        expect(parseScmdbMissionUrl('http://scmdb.net/contracts/DEF456')).toBe('DEF456');
      });

      it('should support hyphen in ID', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/contracts/ABC-123')).toBe('ABC-123');
      });

      it('should support underscore in ID', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/contracts/ABC_123')).toBe('ABC_123');
      });

      it('should accept bare ID (no URL)', () => {
        expect(parseScmdbMissionUrl('ABC123')).toBe('ABC123');
      });

      it('should accept bare ID with hyphens', () => {
        expect(parseScmdbMissionUrl('ABC-123-DEF')).toBe('ABC-123-DEF');
      });

      it('should accept bare ID with underscores', () => {
        expect(parseScmdbMissionUrl('ABC_123_DEF')).toBe('ABC_123_DEF');
      });

      it('should trim whitespace from input', () => {
        expect(parseScmdbMissionUrl('  ABC123  ')).toBe('ABC123');
      });

      it('should trim whitespace from URLs', () => {
        expect(parseScmdbMissionUrl('  https://scmdb.net/contracts/ABC123  ')).toBe('ABC123');
      });

      it('should handle various locales', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/de/contracts/ABC123')).toBe('ABC123');
        expect(parseScmdbMissionUrl('https://scmdb.net/fr/contracts/ABC123')).toBe('ABC123');
        expect(parseScmdbMissionUrl('https://scmdb.net/es/contracts/ABC123')).toBe('ABC123');
      });
    });

    describe('invalid URLs', () => {
      it('should return null for null input', () => {
        expect(parseScmdbMissionUrl(null as unknown as string)).toBeNull();
      });

      it('should return null for undefined input', () => {
        expect(parseScmdbMissionUrl(undefined as unknown as string)).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(parseScmdbMissionUrl('')).toBeNull();
      });

      it('should return null for whitespace only', () => {
        expect(parseScmdbMissionUrl('   ')).toBeNull();
      });

      it('should return null for wrong domain', () => {
        expect(parseScmdbMissionUrl('https://example.com/contracts/ABC123')).toBeNull();
      });

      it('should return null for wrong path', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/missions/ABC123')).toBeNull();
      });

      it('should return null for URL with no ID', () => {
        expect(parseScmdbMissionUrl('https://scmdb.net/contracts/')).toBeNull();
      });

      it('should return null for invalid characters in ID', () => {
        expect(parseScmdbMissionUrl('ABC@123')).toBeNull();
      });

      it('should return null for spaces in ID', () => {
        expect(parseScmdbMissionUrl('ABC 123')).toBeNull();
      });

      it('should return null for special characters', () => {
        expect(parseScmdbMissionUrl('ABC#123')).toBeNull();
        expect(parseScmdbMissionUrl('ABC$123')).toBeNull();
      });

      it('should be case-insensitive for domain but preserve ID case', () => {
        expect(parseScmdbMissionUrl('HTTPS://SCMDB.NET/CONTRACTS/ABC123')).toBe('ABC123');
      });
    });
  });

  describe('isValidScmdbUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidScmdbUrl('https://scmdb.net/contracts/ABC123')).toBe(true);
      expect(isValidScmdbUrl('ABC123')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidScmdbUrl('https://example.com/contracts/ABC123')).toBe(false);
      expect(isValidScmdbUrl('')).toBe(false);
      expect(isValidScmdbUrl('ABC@123')).toBe(false);
    });

    it('should return true for bare IDs', () => {
      expect(isValidScmdbUrl('ABC-123-DEF')).toBe(true);
    });

    it('should return false for null/undefined (via parseScmdbMissionUrl)', () => {
      expect(isValidScmdbUrl(null as unknown as string)).toBe(false);
      expect(isValidScmdbUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe('normalizeScmdbUrl', () => {
    it('should convert bare ID to standard URL', () => {
      expect(normalizeScmdbUrl('ABC123')).toBe('https://scmdb.net/contracts/ABC123');
    });

    it('should return URL unchanged if already normalized', () => {
      const url = 'https://scmdb.net/contracts/ABC123';
      expect(normalizeScmdbUrl(url)).toBe(url);
    });

    it('should normalize URL with locale to base form', () => {
      expect(normalizeScmdbUrl('https://scmdb.net/en/contracts/ABC123')).toBe(
        'https://scmdb.net/contracts/ABC123'
      );
    });

    it('should handle IDs with hyphens', () => {
      expect(normalizeScmdbUrl('ABC-123')).toBe('https://scmdb.net/contracts/ABC-123');
    });

    it('should handle IDs with underscores', () => {
      expect(normalizeScmdbUrl('ABC_123')).toBe('https://scmdb.net/contracts/ABC_123');
    });

    it('should return null for invalid input', () => {
      expect(normalizeScmdbUrl('ABC@123')).toBeNull();
    });

    it('should trim whitespace', () => {
      expect(normalizeScmdbUrl('  ABC123  ')).toBe('https://scmdb.net/contracts/ABC123');
    });
  });
});
