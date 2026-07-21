/**
 * AdminSecurityLogService Tests
 *
 * Tests for admin security event logging and querying:
 * - Logging security events with obfuscated user data
 * - Severity determination
 * - IP address masking
 * - User agent sanitization
 * - Detail sanitization (redact secrets)
 * - Querying events (recent, by type, by severity, search)
 * - Log summary generation
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
    AdminSecurityLogService,
    SecurityEventType,
    SecuritySeverity,
} from '../../../services/admin/AdminSecurityLogService';
import { DataObfuscationService } from '../../../services/admin/DataObfuscationService';

describe('AdminSecurityLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the event store between tests by logging nothing
    // The private store is shared across tests, so we work with fresh events
  });

  // ------------------------------------------------------------------
  // logEvent
  // ------------------------------------------------------------------
  describe('logEvent', () => {
    it('should log a successful login event', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_SUCCESS,
        'pilot-alpha',
        'User logged in via Discord SSO',
        'success',
        {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/120',
        }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const loginEvent = events.find(
        e => e.type === SecurityEventType.LOGIN_SUCCESS && e.action === 'User logged in via Discord SSO'
      );

      expect(loginEvent).toBeDefined();
      expect(loginEvent!.severity).toBe(SecuritySeverity.INFO);
      expect(loginEvent!.outcome).toBe('success');
      expect(loginEvent!.userHash).toBe(DataObfuscationService.hash('pilot-alpha'));
    });

    it('should hash userId and organizationId', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.DATA_ACCESSED,
        'user-123',
        'Accessed fleet roster',
        'success',
        { organizationId: 'org-uee-navy' }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Accessed fleet roster');

      expect(event!.userHash).toBe(DataObfuscationService.hash('user-123'));
      expect(event!.organizationHash).toBe(DataObfuscationService.hash('org-uee-navy'));
    });

    it('should mask IP address (last octet replaced with xxx)', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_FAILURE,
        'attacker',
        'Failed login attempt',
        'failure',
        { ipAddress: '10.20.30.40' }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Failed login attempt');

      expect(event!.ipAddress).toBe('10.20.30.xxx');
    });

    it('should mask non-IPv4 addresses entirely', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_FAILURE,
        'attacker',
        'IPv6 login attempt',
        'failure',
        { ipAddress: '::1' }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'IPv6 login attempt');

      expect(event!.ipAddress).toBe('xxx.xxx.xxx.xxx');
    });

    it('should sanitize user agent to browser/OS only', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_SUCCESS,
        'pilot-bravo',
        'Login from Chrome',
        'success',
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.6099.130' }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Login from Chrome');

      expect(event!.userAgent).toBe('Chrome/Desktop');
    });

    it('should identify Firefox user agent', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_SUCCESS,
        'pilot-charlie',
        'Login from Firefox',
        'success',
        { userAgent: 'Mozilla/5.0 Firefox/115' }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Login from Firefox');

      expect(event!.userAgent).toBe('Firefox/Desktop');
    });

    it('should identify Mobile browser', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_SUCCESS,
        'pilot-delta',
        'Login from mobile',
        'success',
        { userAgent: 'Mobile Android/12' }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Login from mobile');

      expect(event!.userAgent).toBe('Mobile Browser');
    });

    it('should redact sensitive fields in details', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.PASSWORD_CHANGE,
        'pilot-alpha',
        'Password changed',
        'success',
        {
          details: {
            passwordOld: 'old-secret',
            tokenUsed: 'jwt-abc',
            mySecret: 'key-xyz',
            reason: 'User requested',
          },
        }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Password changed');

      expect(event!.details.passwordOld).toBe('[REDACTED]');
      expect(event!.details.tokenUsed).toBe('[REDACTED]');
      expect(event!.details.mySecret).toBe('[REDACTED]');
      expect(event!.details.reason).toBe('User requested');
    });

    it('should sanitize object values in details to [OBJECT]', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.DATA_MODIFIED,
        'admin-01',
        'Config update',
        'success',
        {
          details: {
            config: { nested: 'value' },
            simpleField: 'ok',
          },
        }
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Config update');

      expect(event!.details.config).toBe('[OBJECT]');
      expect(event!.details.simpleField).toBe('ok');
    });
  });

  // ------------------------------------------------------------------
  // Severity determination
  // ------------------------------------------------------------------
  describe('severity determination', () => {
    it('should assign CRITICAL for brute force attempts', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.BRUTE_FORCE_ATTEMPT,
        'attacker',
        'Brute force detected',
        'failure'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Brute force detected');

      expect(event!.severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should assign CRITICAL for suspicious activity', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        'suspect',
        'Unusual access pattern',
        'success'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Unusual access pattern');

      expect(event!.severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should assign CRITICAL for data deletion', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.DATA_DELETED,
        'admin',
        'Fleet data deleted',
        'success'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Fleet data deleted');

      expect(event!.severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should assign WARNING for login failures', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_FAILURE,
        'user',
        'Bad password',
        'failure'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Bad password');

      expect(event!.severity).toBe(SecuritySeverity.WARNING);
    });

    it('should assign WARNING for permission denials', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.PERMISSION_DENIED,
        'user',
        'Unauthorized fleet access',
        'failure'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Unauthorized fleet access');

      expect(event!.severity).toBe(SecuritySeverity.WARNING);
    });

    it('should assign WARNING for any failed outcome on info-level event types', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.DATA_ACCESSED,
        'user',
        'Failed data access',
        'failure'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Failed data access');

      expect(event!.severity).toBe(SecuritySeverity.WARNING);
    });

    it('should assign INFO for successful standard events', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_SUCCESS,
        'user',
        'Normal login',
        'success'
      );

      const events = AdminSecurityLogService.getRecentEvents(100);
      const event = events.find(e => e.action === 'Normal login');

      expect(event!.severity).toBe(SecuritySeverity.INFO);
    });
  });

  // ------------------------------------------------------------------
  // getRecentEvents / getEventsByType / getEventsBySeverity
  // ------------------------------------------------------------------
  describe('getRecentEvents', () => {
    it('should return events respecting limit', () => {
      for (let i = 0; i < 5; i++) {
        AdminSecurityLogService.logEvent(
          SecurityEventType.LOGIN_SUCCESS,
          `user-${i}`,
          `Login ${i}`,
          'success'
        );
      }

      const events = AdminSecurityLogService.getRecentEvents(3);
      expect(events.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.ROLE_CHANGED,
        'admin',
        'Role upgrade test',
        'success'
      );

      const events = AdminSecurityLogService.getEventsByType(SecurityEventType.ROLE_CHANGED);
      const found = events.find(e => e.action === 'Role upgrade test');
      expect(found).toBeDefined();
    });
  });

  describe('getEventsBySeverity', () => {
    it('should filter events by severity', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.BRUTE_FORCE_ATTEMPT,
        'attacker',
        'Critical brute force test',
        'failure'
      );

      const critEvents = AdminSecurityLogService.getEventsBySeverity(SecuritySeverity.CRITICAL);
      const found = critEvents.find(e => e.action === 'Critical brute force test');
      expect(found).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // getLogSummary
  // ------------------------------------------------------------------
  describe('getLogSummary', () => {
    it('should return a summary with correct structure', () => {
      // Log some events for summary
      AdminSecurityLogService.logEvent(SecurityEventType.LOGIN_SUCCESS, 'u1', 'Summary login', 'success');
      AdminSecurityLogService.logEvent(SecurityEventType.LOGIN_FAILURE, 'u2', 'Summary fail', 'failure');
      AdminSecurityLogService.logEvent(SecurityEventType.BRUTE_FORCE_ATTEMPT, 'u3', 'Summary brute', 'failure');

      const summary = AdminSecurityLogService.getLogSummary('24h');

      expect(summary.period).toBe('24h');
      expect(summary.totalEvents).toBeGreaterThanOrEqual(3);
      expect(summary.byType).toBeDefined();
      expect(summary.bySeverity).toBeDefined();
      expect(summary.topEvents).toBeDefined();
      expect(Array.isArray(summary.topEvents)).toBe(true);
      expect(summary.suspiciousActivity).toBeDefined();
      expect(summary.authenticationStats).toBeDefined();
      expect(summary.authorizationStats).toBeDefined();
    });

    it('should accept different period values', () => {
      const summary7d = AdminSecurityLogService.getLogSummary('7d');
      expect(summary7d.period).toBe('7d');

      const summary30d = AdminSecurityLogService.getLogSummary('30d');
      expect(summary30d.period).toBe('30d');
    });

    it('should aggregate suspicious activity counts', () => {
      AdminSecurityLogService.logEvent(SecurityEventType.BRUTE_FORCE_ATTEMPT, 'a1', 'brute1', 'failure');
      AdminSecurityLogService.logEvent(SecurityEventType.API_RATE_LIMIT_EXCEEDED, 'a2', 'rate1', 'failure');
      AdminSecurityLogService.logEvent(SecurityEventType.INVALID_TOKEN, 'a3', 'token1', 'failure');

      const summary = AdminSecurityLogService.getLogSummary('24h');

      expect(summary.suspiciousActivity.bruteForceAttempts).toBeGreaterThanOrEqual(1);
      expect(summary.suspiciousActivity.rateLimitExceeded).toBeGreaterThanOrEqual(1);
      expect(summary.suspiciousActivity.invalidTokens).toBeGreaterThanOrEqual(1);
      expect(summary.suspiciousActivity.total).toBeGreaterThanOrEqual(3);
    });
  });

  // ------------------------------------------------------------------
  // searchEvents
  // ------------------------------------------------------------------
  describe('searchEvents', () => {
    it('should filter by event type', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.FEATURE_FLAG_CHANGED,
        'admin',
        'Flag toggled for search',
        'success'
      );

      const results = AdminSecurityLogService.searchEvents({
        type: SecurityEventType.FEATURE_FLAG_CHANGED,
      });

      const found = results.find(e => e.action === 'Flag toggled for search');
      expect(found).toBeDefined();
    });

    it('should filter by severity', () => {
      AdminSecurityLogService.logEvent(
        SecurityEventType.SUSPICIOUS_ACTIVITY,
        'suspect',
        'Critical search test',
        'failure'
      );

      const results = AdminSecurityLogService.searchEvents({
        severity: SecuritySeverity.CRITICAL,
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by userHash', () => {
      const userId = 'unique-search-user-xyz';
      AdminSecurityLogService.logEvent(
        SecurityEventType.LOGIN_SUCCESS,
        userId,
        'User hash search test',
        'success'
      );

      const userHash = DataObfuscationService.hash(userId);
      const results = AdminSecurityLogService.searchEvents({ userHash });

      const found = results.find(e => e.action === 'User hash search test');
      expect(found).toBeDefined();
    });

    it('should filter by organizationHash', () => {
      const orgId = 'unique-search-org-abc';
      AdminSecurityLogService.logEvent(
        SecurityEventType.DATA_ACCESSED,
        'user',
        'Org hash search test',
        'success',
        { organizationId: orgId }
      );

      const orgHash = DataObfuscationService.hash(orgId);
      const results = AdminSecurityLogService.searchEvents({ organizationHash: orgHash });

      const found = results.find(e => e.action === 'Org hash search test');
      expect(found).toBeDefined();
    });

    it('should filter by date range', () => {
      const beforeLog = new Date();

      AdminSecurityLogService.logEvent(
        SecurityEventType.CONFIGURATION_CHANGED,
        'admin',
        'Date range search test',
        'success'
      );

      const afterLog = new Date();

      const results = AdminSecurityLogService.searchEvents({
        startDate: beforeLog,
        endDate: afterLog,
      });

      const found = results.find(e => e.action === 'Date range search test');
      expect(found).toBeDefined();
    });

    it('should combine multiple search criteria', () => {
      const userId = 'multi-criteria-user';
      AdminSecurityLogService.logEvent(
        SecurityEventType.PERMISSION_DENIED,
        userId,
        'Multi criteria search',
        'failure'
      );

      const userHash = DataObfuscationService.hash(userId);
      const results = AdminSecurityLogService.searchEvents({
        type: SecurityEventType.PERMISSION_DENIED,
        severity: SecuritySeverity.WARNING,
        userHash,
      });

      const found = results.find(e => e.action === 'Multi criteria search');
      expect(found).toBeDefined();
    });
  });
});
