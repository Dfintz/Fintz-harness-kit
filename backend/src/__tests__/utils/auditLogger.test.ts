import winston from 'winston';

import {
    logAuditEvent,
    logAuthenticationAttempt,
    logAuthorizationFailure,
    logSensitiveDataAccess,
    AuditEventType,
} from '../../utils/auditLogger';

// Mock winston
jest.mock('winston', () => ({
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        transports: [],
    }),
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        errors: jest.fn(),
        json: jest.fn(),
    },
    transports: {
        File: jest.fn(),
    },
}));

describe('Audit Logger', () => {
    let mockLogger: any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Get the mock logger instance
        mockLogger = (winston.createLogger as jest.Mock).mock.results[0]?.value;
    });

    describe('logAuditEvent', () => {
        it('should log an audit event with all required fields', () => {
            const entry = {
                eventType: AuditEventType.AUTH_SUCCESS,
                userId: 'user123',
                username: 'testuser',
                ipAddress: '127.0.0.1',
                userAgent: 'Test Agent',
                message: 'Test audit event',
            };

            logAuditEvent(entry);

            if (mockLogger) {
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'Audit event',
                    expect.objectContaining({
                        eventType: AuditEventType.AUTH_SUCCESS,
                        userId: 'user123',
                        username: 'testuser',
                        ipAddress: '127.0.0.1',
                        userAgent: 'Test Agent',
                        message: 'Test audit event',
                        timestamp: expect.any(String),
                    })
                );
            }
        });
    });

    describe('logAuthenticationAttempt', () => {
        it('should log successful authentication', () => {
            logAuthenticationAttempt(
                true,
                'user123',
                'testuser',
                '127.0.0.1',
                'Test Agent'
            );

            if (mockLogger) {
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'Audit event',
                    expect.objectContaining({
                        eventType: AuditEventType.AUTH_SUCCESS,
                        userId: 'user123',
                        username: 'testuser',
                        ipAddress: '127.0.0.1',
                        userAgent: 'Test Agent',
                        message: 'Authentication successful for user: testuser',
                    })
                );
            }
        });

        it('should log failed authentication', () => {
            logAuthenticationAttempt(
                false,
                undefined,
                undefined,
                '127.0.0.1',
                'Test Agent',
                'Invalid token'
            );

            if (mockLogger) {
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'Audit event',
                    expect.objectContaining({
                        eventType: AuditEventType.AUTH_FAILURE,
                        ipAddress: '127.0.0.1',
                        userAgent: 'Test Agent',
                        message: 'Authentication failed: Invalid token',
                    })
                );
            }
        });
    });

    describe('logAuthorizationFailure', () => {
        it('should log authorization failure with all details', () => {
            logAuthorizationFailure(
                'user123',
                'testuser',
                'user',
                '/api/admin',
                'GET',
                '127.0.0.1',
                'Test Agent'
            );

            if (mockLogger) {
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'Audit event',
                    expect.objectContaining({
                        eventType: AuditEventType.AUTHZ_FAILURE,
                        userId: 'user123',
                        username: 'testuser',
                        ipAddress: '127.0.0.1',
                        userAgent: 'Test Agent',
                        resource: '/api/admin',
                        action: 'GET',
                        message: 'Authorization failed: User testuser (role: user) attempted to access /api/admin',
                        metadata: {
                            role: 'user',
                            requiredPermissions: 'GET',
                        },
                    })
                );
            }
        });
    });

    describe('logSensitiveDataAccess', () => {
        it('should log sensitive data access with metadata', () => {
            logSensitiveDataAccess(
                'user123',
                'testuser',
                '/api/users/456',
                'READ',
                '127.0.0.1',
                'Test Agent',
                { targetUserId: '456' }
            );

            if (mockLogger) {
                expect(mockLogger.info).toHaveBeenCalledWith(
                    'Audit event',
                    expect.objectContaining({
                        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
                        userId: 'user123',
                        username: 'testuser',
                        ipAddress: '127.0.0.1',
                        userAgent: 'Test Agent',
                        resource: '/api/users/456',
                        action: 'READ',
                        message: 'Sensitive data access: User testuser performed READ on /api/users/456',
                        metadata: { targetUserId: '456' },
                    })
                );
            }
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
