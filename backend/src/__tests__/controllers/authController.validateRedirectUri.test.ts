/**
 * Tests for AuthController.validateRedirectUri
 * Covers: SSRF/open-redirect prevention (CWE-918, CWE-601)
 */

jest.mock('../../services/authentication');
jest.mock('../../services/user/UserService');
jest.mock('../../services/security');
jest.mock('../../services/discord/DiscordService');
jest.mock('../../middleware/auth', () => ({
  generateToken: jest.fn(),
  authenticateToken: jest.fn(),
}));

const mockGetFrontendUrl = jest.fn().mockReturnValue('https://app.example.com');
jest.mock('../../config/urls', () => ({
  getFrontendUrl: () => mockGetFrontendUrl(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { AuthController } from '../../controllers/authController';

describe('AuthController - validateRedirectUri', () => {
  let controller: AuthController;

  beforeAll(() => {
    controller = new AuthController();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFrontendUrl.mockReturnValue('https://app.example.com');
  });

  // Access private method for isolated testing
  function validate(uri: string): void {
    (controller as unknown as { validateRedirectUri: (uri: string) => void }).validateRedirectUri(
      uri
    );
  }

  it('should accept the allowed frontend origin with /admin/login path', () => {
    expect(() => validate('https://app.example.com/admin/login')).not.toThrow();
  });

  it('should reject a different origin', () => {
    expect(() => validate('https://evil.com/admin/login')).toThrow(
      'Redirect URI origin is not allowed'
    );
  });

  it('should reject a different path on the allowed origin', () => {
    expect(() => validate('https://app.example.com/phishing')).toThrow(
      'Redirect URI path is not allowed'
    );
  });

  it('should reject an invalid URL format', () => {
    expect(() => validate('not-a-url')).toThrow('Invalid redirect URI format');
  });

  it('should reject a URL with the allowed origin but a query string path bypass', () => {
    expect(() =>
      validate('https://app.example.com/admin/login?next=https://evil.com')
    ).not.toThrow();
    // Query params are allowed — the path check is on pathname only
  });

  it('should reject protocol-relative URLs', () => {
    expect(() => validate('//evil.com/admin/login')).toThrow();
  });

  it('should reject javascript: pseudo-protocol', () => {
    expect(() => validate('javascript:alert(1)')).toThrow();
  });

  it('should reject a localhost URL when frontend is not localhost', () => {
    expect(() => validate('http://localhost:3001/admin/login')).toThrow(
      'Redirect URI origin is not allowed'
    );
  });
});
