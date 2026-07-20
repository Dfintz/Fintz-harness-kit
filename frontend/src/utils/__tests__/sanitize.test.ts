/**
 * Sanitization Utility Tests
 * Tests for XSS and injection prevention utilities
 */

import { escapeHtml, sanitizeImageUrl, sanitizeUrl } from '@/utils/sanitize';

describe('sanitizeUrl', () => {
  describe('valid URLs', () => {
    it('should allow https URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
      expect(sanitizeUrl('https://example.com/path?query=value')).toBe(
        'https://example.com/path?query=value'
      );
    });

    it('should allow http URLs', () => {
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
      expect(sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('should allow relative URLs', () => {
      expect(sanitizeUrl('/path/to/resource')).toBe('/path/to/resource');
      expect(sanitizeUrl('/api/v2/data')).toBe('/api/v2/data');
    });

    it('should allow data:image URLs', () => {
      expect(sanitizeUrl('data:image/png;base64,iVBORw0KGg')).toBe(
        'data:image/png;base64,iVBORw0KGg'
      );
      expect(sanitizeUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(
        'data:image/svg+xml;base64,PHN2Zz4='
      );
    });

    it('should trim whitespace', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
      expect(sanitizeUrl('\n/path\n')).toBe('/path');
    });
  });

  describe('dangerous URLs', () => {
    it('should block javascript: protocol', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
      expect(sanitizeUrl('  javascript:void(0)')).toBe('');
    });

    it('should block vbscript: protocol', () => {
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('');
      expect(sanitizeUrl('VBSCRIPT:alert(1)')).toBe('');
    });

    it('should block data:text/html', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(sanitizeUrl('DATA:TEXT/HTML,<script>alert(1)</script>')).toBe('');
    });

    it('should block data:application', () => {
      expect(sanitizeUrl('data:application/javascript,alert(1)')).toBe('');
    });

    it('should block protocol-relative URLs', () => {
      expect(sanitizeUrl('//evil.com')).toBe('');
      expect(sanitizeUrl('//example.com/path')).toBe('');
    });

    it('should block unknown protocols', () => {
      expect(sanitizeUrl('ftp://example.com')).toBe('');
      expect(sanitizeUrl('file:///etc/passwd')).toBe('');
      expect(sanitizeUrl('custom://protocol')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for null/undefined', () => {
      expect(sanitizeUrl(null)).toBe('');
      expect(sanitizeUrl(undefined)).toBe('');
    });

    it('should return empty string for non-string values', () => {
      expect(sanitizeUrl(123 as any)).toBe('');
      expect(sanitizeUrl({} as any)).toBe('');
      expect(sanitizeUrl([] as any)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(sanitizeUrl('')).toBe('');
    });
  });
});

describe('sanitizeImageUrl', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('valid image URLs', () => {
    it('should allow https image URLs', () => {
      expect(sanitizeImageUrl('https://example.com/image.png')).toBe(
        'https://example.com/image.png'
      );
      expect(sanitizeImageUrl('https://cdn.example.com/avatar.jpg')).toBe(
        'https://cdn.example.com/avatar.jpg'
      );
    });

    it('should allow data:image URLs', () => {
      expect(sanitizeImageUrl('data:image/png;base64,iVBORw0KGg')).toBe(
        'data:image/png;base64,iVBORw0KGg'
      );
      expect(sanitizeImageUrl('data:image/gif;base64,R0lGOD')).toBe('data:image/gif;base64,R0lGOD');
    });

    it('should allow relative image URLs', () => {
      expect(sanitizeImageUrl('/images/avatar.png')).toBe('/images/avatar.png');
      expect(sanitizeImageUrl('/static/logo.svg')).toBe('/static/logo.svg');
    });

    it('should allow http URLs in development', () => {
      process.env.NODE_ENV = 'development';
      expect(sanitizeImageUrl('http://localhost:3000/image.png')).toBe(
        'http://localhost:3000/image.png'
      );
    });

    it('should trim whitespace', () => {
      expect(sanitizeImageUrl('  https://example.com/image.png  ')).toBe(
        'https://example.com/image.png'
      );
    });

    it('should convert Azure Blob Storage URLs to API proxy URLs', () => {
      // getApiBase() falls back to window.location.origin in test env
      const origin = window.location.origin;
      expect(
        sanitizeImageUrl(
          'https://scfleethbgavvwxxc4f6.blob.core.windows.net/images/cda0bbff-5529-4e8c-8dd6-2277df509291.png'
        )
      ).toBe(`${origin}/api/v2/images/download/cda0bbff-5529-4e8c-8dd6-2277df509291.png`);
    });

    it('should handle blob URLs with special characters in filename', () => {
      const origin = window.location.origin;
      expect(
        sanitizeImageUrl('https://myaccount.blob.core.windows.net/images/file%20name.jpg')
      ).toBe(`${origin}/api/v2/images/download/file%2520name.jpg`);
    });

    it('should convert bare image filenames to API proxy URLs', () => {
      const origin = window.location.origin;
      expect(sanitizeImageUrl('08c6e622-c515-4a14-8deb-e1722ffcb788.png')).toBe(
        `${origin}/api/v2/images/download/08c6e622-c515-4a14-8deb-e1722ffcb788.png`
      );
      expect(sanitizeImageUrl('1232f64f-5fe5-4f9c-9e39-105183101d7d.png')).toBe(
        `${origin}/api/v2/images/download/1232f64f-5fe5-4f9c-9e39-105183101d7d.png`
      );
    });

    it('should handle bare filenames with various image extensions', () => {
      const origin = window.location.origin;
      expect(sanitizeImageUrl('abc-123.jpg')).toBe(`${origin}/api/v2/images/download/abc-123.jpg`);
      expect(sanitizeImageUrl('abc-123.jpeg')).toBe(
        `${origin}/api/v2/images/download/abc-123.jpeg`
      );
      expect(sanitizeImageUrl('abc-123.webp')).toBe(
        `${origin}/api/v2/images/download/abc-123.webp`
      );
      expect(sanitizeImageUrl('abc-123.gif')).toBe(`${origin}/api/v2/images/download/abc-123.gif`);
      expect(sanitizeImageUrl('abc-123.avif')).toBe(
        `${origin}/api/v2/images/download/abc-123.avif`
      );
      expect(sanitizeImageUrl('abc-123.svg')).toBe(`${origin}/api/v2/images/download/abc-123.svg`);
    });

    it('should rewrite relative /api/v2/images/ paths to absolute URLs', () => {
      const origin = window.location.origin;
      expect(sanitizeImageUrl('/api/v2/images/download/some-file.png')).toBe(
        `${origin}/api/v2/images/download/some-file.png`
      );
    });

    it('should rewrite legacy /uploads/ paths to API proxy URLs', () => {
      const origin = window.location.origin;
      expect(sanitizeImageUrl('/uploads/old-file.png')).toBe(
        `${origin}/api/v2/images/download/old-file.png`
      );
    });
  });

  describe('blocked image URLs', () => {
    it('should block protocol-relative URLs', () => {
      expect(sanitizeImageUrl('//evil.com/image.png')).toBe('');
    });

    it('should block http URLs in production', () => {
      process.env.NODE_ENV = 'production';
      expect(sanitizeImageUrl('http://example.com/image.png')).toBe('');
    });

    it('should block javascript URLs', () => {
      expect(sanitizeImageUrl('javascript:alert(1)')).toBe('');
    });

    it('should block unknown protocols', () => {
      expect(sanitizeImageUrl('ftp://example.com/image.png')).toBe('');
      expect(sanitizeImageUrl('file:///path/image.png')).toBe('');
    });

    it('should block bare filenames with non-image extensions', () => {
      expect(sanitizeImageUrl('malicious.html')).toBe('');
      expect(sanitizeImageUrl('script.js')).toBe('');
      expect(sanitizeImageUrl('payload.exe')).toBe('');
      expect(sanitizeImageUrl('data.json')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for null/undefined', () => {
      expect(sanitizeImageUrl(null)).toBe('');
      expect(sanitizeImageUrl(undefined)).toBe('');
    });

    it('should return empty string for non-string values', () => {
      expect(sanitizeImageUrl(123 as any)).toBe('');
      expect(sanitizeImageUrl({} as any)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(sanitizeImageUrl('')).toBe('');
    });
  });
});

describe('escapeHtml', () => {
  describe('escaping special characters', () => {
    it('should escape ampersand', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
      expect(escapeHtml('1 < 2')).toBe('1 &lt; 2');
    });

    it('should escape greater than', () => {
      expect(escapeHtml('2 > 1')).toBe('2 &gt; 1');
    });

    it('should escape double quotes', () => {
      expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("It's fine")).toBe('It&#x27;s fine');
    });

    it('should escape forward slashes', () => {
      expect(escapeHtml('path/to/file')).toBe('path&#x2F;to&#x2F;file');
    });

    it('should escape multiple special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
      );
    });
  });

  describe('preserving safe content', () => {
    it('should not modify plain text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('should preserve numbers', () => {
      expect(escapeHtml('12345')).toBe('12345');
    });

    it('should preserve unicode characters', () => {
      expect(escapeHtml('Hello 世界')).toBe('Hello 世界');
      expect(escapeHtml('🚀 Rocket')).toBe('🚀 Rocket');
    });
  });

  describe('edge cases', () => {
    it('should return empty string for null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for non-string values', () => {
      expect(escapeHtml(123 as any)).toBe('');
      expect(escapeHtml({} as any)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(escapeHtml('')).toBe('');
    });
  });
});
