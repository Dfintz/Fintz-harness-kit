/**
 * Unit tests for URL safety utilities
 * Tests prevention of open redirect vulnerabilities (CWE-601)
 */
import { describe, expect, it } from '@jest/globals';
import { isSafeExternalUrl, isSafeInternalPath, sanitizeInternalPath } from '@/utils/urlSafety';

describe('urlSafety utilities', () => {
  describe('isSafeExternalUrl', () => {
    it('should allow valid HTTPS URLs', () => {
      expect(isSafeExternalUrl('https://example.com')).toBe(true);
      expect(isSafeExternalUrl('https://discord.gg/invite123')).toBe(true);
      expect(isSafeExternalUrl('https://robertsspaceindustries.com')).toBe(true);
    });

    it('should allow valid HTTP URLs', () => {
      expect(isSafeExternalUrl('http://example.com')).toBe(true);
      expect(isSafeExternalUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject javascript: URLs', () => {
      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeExternalUrl('javascript:void(0)')).toBe(false);
    });

    it('should reject data: URLs', () => {
      expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should reject file: URLs', () => {
      expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject null, undefined, and empty strings', () => {
      expect(isSafeExternalUrl(null)).toBe(false);
      expect(isSafeExternalUrl(undefined)).toBe(false);
      expect(isSafeExternalUrl('')).toBe(false);
      expect(isSafeExternalUrl('   ')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isSafeExternalUrl('not a url')).toBe(false);
      expect(isSafeExternalUrl('//example.com')).toBe(false);
    });
  });

  describe('isSafeInternalPath', () => {
    it('should allow valid internal paths', () => {
      expect(isSafeInternalPath('/')).toBe(true);
      expect(isSafeInternalPath('/dashboard')).toBe(true);
      expect(isSafeInternalPath('/organizations/123')).toBe(true);
      expect(isSafeInternalPath('/fleet/ships?tab=active')).toBe(true);
    });

    it('should reject protocol-relative URLs', () => {
      expect(isSafeInternalPath('//evil.com')).toBe(false);
      expect(isSafeInternalPath('//evil.com/path')).toBe(false);
    });

    it('should reject URLs with protocols', () => {
      expect(isSafeInternalPath('http://example.com')).toBe(false);
      expect(isSafeInternalPath('https://example.com/path')).toBe(false);
      expect(isSafeInternalPath('javascript:alert(1)')).toBe(false);
      expect(isSafeInternalPath('data:text/html,content')).toBe(false);
    });

    it('should reject paths that do not start with /', () => {
      expect(isSafeInternalPath('dashboard')).toBe(false);
      expect(isSafeInternalPath('organizations/123')).toBe(false);
    });

    it('should reject backslash paths', () => {
      expect(isSafeInternalPath('/path\\to\\evil')).toBe(false);
      expect(isSafeInternalPath('\\\\network\\share')).toBe(false);
    });

    it('should reject null, undefined, and empty strings', () => {
      expect(isSafeInternalPath(null)).toBe(false);
      expect(isSafeInternalPath(undefined)).toBe(false);
      expect(isSafeInternalPath('')).toBe(false);
    });

    it('should handle paths with query strings and fragments', () => {
      expect(isSafeInternalPath('/dashboard?tab=1')).toBe(true);
      expect(isSafeInternalPath('/fleet#ships')).toBe(true);
      expect(isSafeInternalPath('/organizations?sort=name&order=asc')).toBe(true);
    });
  });

  describe('sanitizeInternalPath', () => {
    it('should return safe paths unchanged', () => {
      expect(sanitizeInternalPath('/')).toBe('/');
      expect(sanitizeInternalPath('/dashboard')).toBe('/dashboard');
      expect(sanitizeInternalPath('/organizations/123')).toBe('/organizations/123');
    });

    it('should return default path for unsafe paths', () => {
      expect(sanitizeInternalPath('http://evil.com')).toBe('/');
      expect(sanitizeInternalPath('//evil.com')).toBe('/');
      expect(sanitizeInternalPath('javascript:alert(1)')).toBe('/');
      expect(sanitizeInternalPath('dashboard')).toBe('/');
    });

    it('should return custom default path', () => {
      expect(sanitizeInternalPath('http://evil.com', '/login')).toBe('/login');
      expect(sanitizeInternalPath(null, '/dashboard')).toBe('/dashboard');
      expect(sanitizeInternalPath(undefined, '/home')).toBe('/home');
    });

    it('should handle edge cases', () => {
      expect(sanitizeInternalPath('')).toBe('/');
      expect(sanitizeInternalPath(null)).toBe('/');
      expect(sanitizeInternalPath(undefined)).toBe('/');
      expect(sanitizeInternalPath('   ')).toBe('/');
    });
  });

  describe('real-world attack scenarios', () => {
    it('should prevent open redirect via sessionStorage', () => {
      const maliciousPath = 'https://attacker.com/phishing';
      expect(isSafeInternalPath(maliciousPath)).toBe(false);
      expect(sanitizeInternalPath(maliciousPath)).toBe('/');
    });

    it('should prevent protocol-relative open redirect', () => {
      const maliciousPath = '//attacker.com/phishing';
      expect(isSafeInternalPath(maliciousPath)).toBe(false);
      expect(sanitizeInternalPath(maliciousPath)).toBe('/');
    });

    it('should prevent javascript protocol injection', () => {
      const maliciousPath = 'javascript:window.location="https://attacker.com"';
      expect(isSafeInternalPath(maliciousPath)).toBe(false);
      expect(sanitizeInternalPath(maliciousPath)).toBe('/');
    });

    it('should allow legitimate navigation after login', () => {
      const legitimatePaths = [
        '/dashboard',
        '/organizations',
        '/fleet/ships',
        '/calendar',
        '/directory/123',
      ];

      legitimatePaths.forEach(path => {
        expect(isSafeInternalPath(path)).toBe(true);
        expect(sanitizeInternalPath(path)).toBe(path);
      });
    });
  });
});
