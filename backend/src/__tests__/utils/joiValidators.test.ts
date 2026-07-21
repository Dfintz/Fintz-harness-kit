/**
 * Test suite for joiValidators singleton pattern and functionality
 */

import {
  discordIdSchema,
  discordUsernameSchema,
  getJoiValidators,
  isLocalhost,
  isPrivateIP,
  JoiExtended,
  phoneNumberSchema,
  removeSQLPatterns,
  sanitizedStringSchema,
  sanitizeFilename,
  sanitizeString,
  sanitizeURL,
  secureEmailSchema,
  secureFilenameSchema,
  secureUrlSchema,
} from '../../utils/joiValidators';

describe('joiValidators Singleton Pattern', () => {
  describe('getJoiValidators', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = getJoiValidators();
      const instance2 = getJoiValidators();
      const instance3 = getJoiValidators();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(instance3);
    });

    it('should have all expected properties', () => {
      const instance = getJoiValidators();

      expect(instance).toHaveProperty('secureUrlSchema');
      expect(instance).toHaveProperty('secureEmailSchema');
      expect(instance).toHaveProperty('discordIdSchema');
      expect(instance).toHaveProperty('discordUsernameSchema');
      expect(instance).toHaveProperty('secureFilenameSchema');
      expect(instance).toHaveProperty('phoneNumberSchema');
      expect(instance).toHaveProperty('sanitizedStringSchema');
      expect(instance).toHaveProperty('sanitizeString');
      expect(instance).toHaveProperty('removeSQLPatterns');
      expect(instance).toHaveProperty('sanitizeFilename');
      expect(instance).toHaveProperty('sanitizeURL');
      expect(instance).toHaveProperty('isPrivateIP');
      expect(instance).toHaveProperty('isLocalhost');
    });
  });

  describe('JoiExtended singleton', () => {
    it('should be a Joi instance', () => {
      expect(JoiExtended).toBeDefined();
      expect(typeof JoiExtended.string).toBe('function');
      expect(typeof JoiExtended.number).toBe('function');
      expect(typeof JoiExtended.object).toBe('function');
    });

    it('should maintain consistent behavior across uses', () => {
      const schema1 = JoiExtended.string().min(5);
      const schema2 = JoiExtended.string().min(5);

      const testString = 'hello';
      const result1 = schema1.validate(testString);
      const result2 = schema2.validate(testString);

      expect(result1.error).toBeUndefined();
      expect(result2.error).toBeUndefined();
      expect(result1.value).toBe(result2.value);
    });
  });
});

describe('joiValidators Schemas', () => {
  describe('secureUrlSchema', () => {
    it('should validate valid HTTP URLs', () => {
      const result = secureUrlSchema.validate('http://example.com');
      expect(result.error).toBeUndefined();
      expect(result.value).toBe('http://example.com');
    });

    it('should validate valid HTTPS URLs', () => {
      const result = secureUrlSchema.validate('https://example.com');
      expect(result.error).toBeUndefined();
      expect(result.value).toBe('https://example.com');
    });

    it('should reject invalid URLs', () => {
      const result = secureUrlSchema.validate('not a url');
      expect(result.error).toBeDefined();
    });

    it('should reject URLs exceeding max length', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      const result = secureUrlSchema.validate(longUrl);
      expect(result.error).toBeDefined();
    });

    it('should reject empty strings', () => {
      const result = secureUrlSchema.validate('');
      expect(result.error).toBeDefined();
    });

    it('should reject localhost URLs', () => {
      const result = secureUrlSchema.validate('http://localhost:3000/callback');
      expect(result.error).toBeDefined();
    });

    it('should reject private IP URLs', () => {
      const privateUrls = [
        'http://10.0.0.5/internal',
        'http://172.16.0.10/health',
        'http://192.168.1.15/dashboard',
      ];

      privateUrls.forEach(url => {
        const result = secureUrlSchema.validate(url);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject URLs with embedded credentials', () => {
      const result = secureUrlSchema.validate('https://user:pass@example.com/path');
      expect(result.error).toBeDefined();
    });
  });

  describe('secureEmailSchema', () => {
    it('should validate valid email addresses', () => {
      const validEmails = ['test@example.com', 'user.name@example.co.uk', 'user+tag@example.com'];

      validEmails.forEach(email => {
        const result = secureEmailSchema.validate(email);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(email);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com', // Space
        'user<script>@example.com', // XSS attempt
      ];

      invalidEmails.forEach(email => {
        const result = secureEmailSchema.validate(email);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject emails with suspicious patterns', () => {
      const suspiciousEmails = [
        'user@example..com', // Double dots
        'user\x00@example.com', // Null byte
        'user\n@example.com', // Line break
      ];

      suspiciousEmails.forEach(email => {
        const result = secureEmailSchema.validate(email);
        expect(result.error).toBeDefined();
      });
    });

    it('should enforce max length of 254 characters', () => {
      const longLocal = 'a'.repeat(240);
      const longEmail = `${longLocal}@example.com`;
      const result = secureEmailSchema.validate(longEmail);
      expect(result.error).toBeDefined();
    });
  });

  describe('discordIdSchema', () => {
    it('should validate valid Discord IDs', () => {
      const validIds = [
        '12345678901234567', // 17 digits
        '123456789012345678', // 18 digits
        '1234567890123456789', // 19 digits
      ];

      validIds.forEach(id => {
        const result = discordIdSchema.validate(id);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(id);
      });
    });

    it('should reject invalid Discord IDs', () => {
      const invalidIds = [
        '1234567890123456', // Too short
        '12345678901234567890', // Too long
        'abcdefghijklmnopq', // Not numeric
        '123456789012345a7', // Contains letter
      ];

      invalidIds.forEach(id => {
        const result = discordIdSchema.validate(id);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('discordUsernameSchema', () => {
    it('should validate valid Discord usernames', () => {
      const validUsernames = ['Username', 'User123', 'User_Name', 'Test User'];

      validUsernames.forEach(username => {
        const result = discordUsernameSchema.validate(username);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(username);
      });
    });

    it('should reject invalid Discord usernames', () => {
      const invalidUsernames = [
        'U', // Too short
        'a'.repeat(33), // Too long
        'User<script>', // XSS attempt
        'User@User', // @ symbol
      ];

      invalidUsernames.forEach(username => {
        const result = discordUsernameSchema.validate(username);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('secureFilenameSchema', () => {
    it('should validate safe filenames', () => {
      const validFilenames = ['document.pdf', 'image.png', 'file-name.txt', 'file_name.docx'];

      validFilenames.forEach(filename => {
        const result = secureFilenameSchema.validate(filename);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(filename);
      });
    });

    it('should reject filenames with path traversal', () => {
      const result = secureFilenameSchema.validate('../etc/passwd');
      expect(result.error).toBeDefined();
    });

    it('should reject hidden files', () => {
      const result = secureFilenameSchema.validate('.hidden');
      expect(result.error).toBeDefined();
    });

    it('should reject executable extensions', () => {
      const dangerousExtensions = [
        'malware.exe',
        'script.bat',
        'command.cmd',
        'shell.sh',
        'powershell.ps1',
      ];

      dangerousExtensions.forEach(filename => {
        const result = secureFilenameSchema.validate(filename);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject filenames with invalid characters', () => {
      const invalidFilenames = ['file<name.txt', 'file>name.txt', 'file:name.txt', 'file|name.txt'];

      invalidFilenames.forEach(filename => {
        const result = secureFilenameSchema.validate(filename);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('phoneNumberSchema', () => {
    it('should validate valid phone numbers', () => {
      const validPhones = ['1234567890', '+12345678900', '123-456-7890'];

      validPhones.forEach(phone => {
        const result = phoneNumberSchema.validate(phone);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(phone);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        'abcd', // Letters
        '123<script>', // XSS attempt
        'call-me-maybe', // Letters
      ];

      invalidPhones.forEach(phone => {
        const result = phoneNumberSchema.validate(phone);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('sanitizedStringSchema', () => {
    it('should sanitize HTML special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizedStringSchema.validate(input);
      expect(result.error).toBeUndefined();
      expect(result.value).not.toContain('<script>');
      expect(result.value).toContain('&lt;');
      expect(result.value).toContain('&gt;');
    });
  });
});

describe('joiValidators Utility Functions', () => {
  describe('sanitizeString', () => {
    it('should encode HTML special characters', () => {
      expect(sanitizeString('<div>')).toBe('&lt;div&gt;');
      expect(sanitizeString('A & B')).toBe('A &amp; B');
      expect(sanitizeString('"quoted"')).toBe('&quot;quoted&quot;');
      expect(sanitizeString("'single'")).toBe('&#x27;single&#x27;');
    });

    it('should handle strings without special characters', () => {
      expect(sanitizeString('normal text')).toBe('normal text');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('removeSQLPatterns', () => {
    it('should remove SQL keywords', () => {
      const result = removeSQLPatterns(
        'SELECT * FROM users WHERE id = 1 UNION SELECT * FROM admin'
      );
      // These keywords should be removed
      expect(result).not.toMatch(/\bSELECT\b/i);
      expect(result).not.toMatch(/\bUNION\b/i);
      // FROM and WHERE are not in the removal list, so they will remain
      // This is intentional - only the most dangerous keywords are removed
      expect(result.length).toBeLessThan(
        'SELECT * FROM users WHERE id = 1 UNION SELECT * FROM admin'.length
      );
    });

    it('should remove MongoDB operators', () => {
      const result = removeSQLPatterns('username: $ne: null');
      expect(result).not.toContain('$ne');
    });

    it('should remove script tags', () => {
      const result = removeSQLPatterns('<script>alert("XSS")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should remove javascript: protocol', () => {
      const result = removeSQLPatterns('javascript:alert("XSS")');
      expect(result).not.toContain('javascript:');
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove path components', () => {
      expect(sanitizeFilename('/path/to/file.txt')).toBe('file.txt');
      expect(sanitizeFilename('..\\..\\file.txt')).toBe('file.txt');
    });

    it('should remove invalid characters', () => {
      const result = sanitizeFilename('file<name>.txt');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should remove leading dots and spaces', () => {
      expect(sanitizeFilename('  .file.txt')).toBe('file.txt');
    });

    it('should limit length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });

    it('should return "unnamed" for invalid filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('   ')).toBe('unnamed');
    });
  });

  describe('sanitizeURL', () => {
    it('should preserve valid HTTP URLs', () => {
      const url = 'http://example.com/path?query=value#fragment';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should preserve valid HTTPS URLs', () => {
      const url = 'https://example.com/path';
      const result = sanitizeURL(url);
      expect(result).toBe(url);
    });

    it('should reject dangerous protocols', () => {
      expect(sanitizeURL('javascript:alert("XSS")')).toBe('');
      expect(sanitizeURL('file:///etc/passwd')).toBe('');
      expect(sanitizeURL('data:text/html,<script>alert(1)</script>')).toBe('');
    });

    it('should handle invalid URLs', () => {
      expect(sanitizeURL('not a url')).toBe('');
      expect(sanitizeURL('')).toBe('');
    });
  });

  describe('isPrivateIP', () => {
    it('should detect private IPv4 addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('169.254.1.1')).toBe(true);
    });

    it('should detect special IPv4 addresses', () => {
      expect(isPrivateIP('0.0.0.0')).toBe(true);
      expect(isPrivateIP('255.255.255.255')).toBe(true);
    });

    it('should detect private IPv6 addresses', () => {
      expect(isPrivateIP('fe80::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd00::1')).toBe(true);
    });

    it('should not flag public IP addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('example.com')).toBe(false);
    });
  });

  describe('isLocalhost', () => {
    it('should detect localhost strings', () => {
      expect(isLocalhost('localhost')).toBe(true);
      expect(isLocalhost('127.0.0.1')).toBe(true);
      expect(isLocalhost('::1')).toBe(true);
      expect(isLocalhost('0.0.0.0')).toBe(true);
    });

    it('should detect 127.x.x.x addresses', () => {
      expect(isLocalhost('127.0.0.2')).toBe(true);
      expect(isLocalhost('127.1.1.1')).toBe(true);
    });

    it('should not flag non-localhost addresses', () => {
      expect(isLocalhost('example.com')).toBe(false);
      expect(isLocalhost('192.168.1.1')).toBe(false);
      expect(isLocalhost('8.8.8.8')).toBe(false);
    });
  });
});

describe('Multiple Module Import Consistency', () => {
  it('should maintain same validators across re-imports', () => {
    // Simulate module being imported multiple times in different files
    const validators1 = getJoiValidators();
    const validators2 = getJoiValidators();

    // Both should reference the same object
    expect(validators1).toBe(validators2);

    // Schemas should work consistently
    const email = 'test@example.com';
    const result1 = validators1.secureEmailSchema.validate(email);
    const result2 = validators2.secureEmailSchema.validate(email);

    expect(result1.error).toBeUndefined();
    expect(result2.error).toBeUndefined();
    expect(result1.value).toBe(result2.value);
  });

  it('should maintain consistent validation behavior', () => {
    const validators = getJoiValidators();

    // Test email validation consistency
    const email = 'test@example.com';
    const emailResult1 = validators.secureEmailSchema.validate(email);
    const emailResult2 = validators.secureEmailSchema.validate(email);
    expect(emailResult1.error).toBeUndefined();
    expect(emailResult2.error).toBeUndefined();
    expect(emailResult1.value).toBe(emailResult2.value);

    // Test Discord ID validation consistency
    const validId = '12345678901234567';
    const idResult1 = validators.discordIdSchema.validate(validId);
    const idResult2 = validators.discordIdSchema.validate(validId);
    expect(idResult1.error).toBeUndefined();
    expect(idResult2.error).toBeUndefined();
    expect(idResult1.value).toBe(idResult2.value);

    // Test invalid input consistency
    const invalidId = 'invalid';
    const invalidResult1 = validators.discordIdSchema.validate(invalidId);
    const invalidResult2 = validators.discordIdSchema.validate(invalidId);
    expect(invalidResult1.error).toBeDefined();
    expect(invalidResult2.error).toBeDefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
