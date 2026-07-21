/**
 * Tests for Session Binding Middleware
 */

import { Request, Response, NextFunction } from 'express';

import {
    generateBindingHash,
    createSessionBinding,
    validateSessionBinding,
    sessionBindingMiddleware,
    addSessionBindingToPayload,
    SessionBinding,
    SessionBindingConfig
} from '../../middleware/sessionBinding';
import { AuthRequest } from '../../middleware/auth';

// Mock logger
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn()
    },
logger: {
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn()
    }
}));

describe('Session Binding Middleware', () => {
    describe('generateBindingHash', () => {
        it('should generate a consistent hash for the same input', () => {
            const hash1 = generateBindingHash('test-value');
            const hash2 = generateBindingHash('test-value');
            
            expect(hash1).toBe(hash2);
        });

        it('should generate a 16-character hex string', () => {
            const hash = generateBindingHash('test-value');
            
            expect(hash).toHaveLength(16);
            expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
        });

        it('should generate different hashes for different inputs', () => {
            const hash1 = generateBindingHash('value1');
            const hash2 = generateBindingHash('value2');
            
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty strings', () => {
            const hash = generateBindingHash('');
            
            expect(hash).toHaveLength(16);
        });
    });

    describe('createSessionBinding', () => {
        it('should create binding from request with IP and user agent', () => {
            const mockReq = {
                ip: '192.168.1.1',
                socket: { remoteAddress: '192.168.1.1' },
                headers: {
                    'user-agent': 'Mozilla/5.0 Test Browser'
                }
            } as unknown as Request;

            const binding = createSessionBinding(mockReq);

            expect(binding.ipHash).toBeDefined();
            expect(binding.uaHash).toBeDefined();
            expect(binding.deviceHash).toBeUndefined();
        });

        it('should include device fingerprint when provided', () => {
            const mockReq = {
                ip: '192.168.1.1',
                socket: { remoteAddress: '192.168.1.1' },
                headers: {
                    'user-agent': 'Mozilla/5.0 Test Browser',
                    'x-device-fingerprint': 'device-fp-123'
                }
            } as unknown as Request;

            const binding = createSessionBinding(mockReq);

            expect(binding.deviceHash).toBeDefined();
        });

        it('should fall back to socket.remoteAddress when ip is undefined', () => {
            const mockReq = {
                ip: undefined,
                socket: { remoteAddress: '10.0.0.1' },
                headers: {
                    'user-agent': 'Test Agent'
                }
            } as unknown as Request;

            const binding = createSessionBinding(mockReq);

            expect(binding.ipHash).toBeDefined();
        });

        it('should use "unknown" for missing values', () => {
            const mockReq = {
                ip: undefined,
                socket: { remoteAddress: undefined },
                headers: {}
            } as unknown as Request;

            const binding = createSessionBinding(mockReq);

            expect(binding.ipHash).toBeDefined();
            expect(binding.uaHash).toBeDefined();
        });
    });

    describe('validateSessionBinding', () => {
        const createBinding = (ip: string, ua: string, device?: string): SessionBinding => ({
            ipHash: generateBindingHash(ip),
            uaHash: generateBindingHash(ua),
            deviceHash: device ? generateBindingHash(device) : undefined
        });

        it('should return valid when all bindings match', () => {
            const stored = createBinding('192.168.1.1', 'Chrome');
            const current = createBinding('192.168.1.1', 'Chrome');

            const result = validateSessionBinding(stored, current);

            expect(result.valid).toBe(true);
            expect(result.mismatches).toHaveLength(0);
        });

        it('should detect IP address change', () => {
            const stored = createBinding('192.168.1.1', 'Chrome');
            const current = createBinding('10.0.0.1', 'Chrome');
            const config: SessionBindingConfig = {
                validateIp: true,
                validateUserAgent: true,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(false);
            expect(result.mismatches).toContain('IP address changed');
        });

        it('should detect User-Agent change', () => {
            const stored = createBinding('192.168.1.1', 'Chrome');
            const current = createBinding('192.168.1.1', 'Firefox');
            const config: SessionBindingConfig = {
                validateIp: false,
                validateUserAgent: true,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(false);
            expect(result.mismatches).toContain('User-Agent changed');
        });

        it('should detect device fingerprint change', () => {
            const stored = createBinding('192.168.1.1', 'Chrome', 'device1');
            const current = createBinding('192.168.1.1', 'Chrome', 'device2');
            const config: SessionBindingConfig = {
                validateIp: false,
                validateUserAgent: false,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(false);
            expect(result.mismatches).toContain('Device fingerprint changed');
        });

        it('should skip device fingerprint validation when not present in stored', () => {
            const stored = createBinding('192.168.1.1', 'Chrome');
            const current = createBinding('192.168.1.1', 'Chrome', 'device1');
            const config: SessionBindingConfig = {
                validateIp: false,
                validateUserAgent: false,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(true);
        });

        it('should skip device fingerprint validation when not present in current', () => {
            const stored = createBinding('192.168.1.1', 'Chrome', 'device1');
            const current = createBinding('192.168.1.1', 'Chrome');
            const config: SessionBindingConfig = {
                validateIp: false,
                validateUserAgent: false,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(true);
        });

        it('should skip IP validation when disabled', () => {
            const stored = createBinding('192.168.1.1', 'Chrome');
            const current = createBinding('10.0.0.1', 'Chrome');
            const config: SessionBindingConfig = {
                validateIp: false,
                validateUserAgent: true,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(true);
        });

        it('should detect multiple mismatches', () => {
            const stored = createBinding('192.168.1.1', 'Chrome', 'device1');
            const current = createBinding('10.0.0.1', 'Firefox', 'device2');
            const config: SessionBindingConfig = {
                validateIp: true,
                validateUserAgent: true,
                validateDeviceFingerprint: true,
                allowSubnetChange: false,
                warnOnly: false
            };

            const result = validateSessionBinding(stored, current, config);

            expect(result.valid).toBe(false);
            expect(result.mismatches).toHaveLength(3);
        });
    });

    describe('sessionBindingMiddleware', () => {
        let mockReq: Partial<AuthRequest>;
        let mockRes: Partial<Response>;
        let mockNext: NextFunction;
        let jsonMock: jest.Mock;
        let statusMock: jest.Mock;

        beforeEach(() => {
            jsonMock = jest.fn();
            statusMock = jest.fn().mockReturnThis();

            mockReq = {
                ip: '192.168.1.1',
                socket: { remoteAddress: '192.168.1.1' } as any,
                path: '/api/test',
                method: 'GET',
                headers: {
                    'user-agent': 'Test Browser'
                },
                user: undefined
            };
            mockRes = {
                status: statusMock,
                json: jsonMock
            };
            mockNext = jest.fn();
        });

        it('should skip validation when user is not authenticated', () => {
            const middleware = sessionBindingMiddleware();

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should skip validation when no session binding in token', () => {
            const middleware = sessionBindingMiddleware();
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'user' };

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should call next() when session binding matches', () => {
            const middleware = sessionBindingMiddleware({ validateIp: false });
            const binding = createSessionBinding(mockReq as Request);
            mockReq.user = {
                id: 'user-1',
                username: 'testuser',
                role: 'user',
                sessionBinding: binding
            } as any;

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should return 403 when session binding does not match', () => {
            const middleware = sessionBindingMiddleware({ 
                validateUserAgent: true,
                warnOnly: false 
            });
            const differentBinding: SessionBinding = {
                ipHash: generateBindingHash('different-ip'),
                uaHash: generateBindingHash('Different Browser')
            };
            mockReq.user = {
                id: 'user-1',
                username: 'testuser',
                role: 'user',
                sessionBinding: differentBinding
            } as any;

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Session binding validation failed',
                code: 'SESSION_BINDING_MISMATCH'
            }));
        });

        it('should allow request when warnOnly is true', () => {
            const middleware = sessionBindingMiddleware({ 
                validateUserAgent: true,
                warnOnly: true 
            });
            const differentBinding: SessionBinding = {
                ipHash: generateBindingHash('different-ip'),
                uaHash: generateBindingHash('Different Browser')
            };
            mockReq.user = {
                id: 'user-1',
                username: 'testuser',
                role: 'user',
                sessionBinding: differentBinding
            } as any;

            middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });
    });

    describe('addSessionBindingToPayload', () => {
        it('should add session binding to payload', () => {
            const mockReq = {
                ip: '192.168.1.1',
                socket: { remoteAddress: '192.168.1.1' },
                headers: {
                    'user-agent': 'Test Browser'
                }
            } as unknown as Request;
            const payload = { userId: 'user-1' };

            const result = addSessionBindingToPayload(payload, mockReq);

            expect(result.userId).toBe('user-1');
            expect(result.sessionBinding).toBeDefined();
            expect((result.sessionBinding as SessionBinding).ipHash).toBeDefined();
            expect((result.sessionBinding as SessionBinding).uaHash).toBeDefined();
        });

        it('should preserve existing payload properties', () => {
            const mockReq = {
                ip: '192.168.1.1',
                socket: { remoteAddress: '192.168.1.1' },
                headers: {
                    'user-agent': 'Test Browser'
                }
            } as unknown as Request;
            const payload = {
                userId: 'user-1',
                role: 'admin',
                exp: 123456
            };

            const result = addSessionBindingToPayload(payload, mockReq);

            expect(result.userId).toBe('user-1');
            expect(result.role).toBe('admin');
            expect(result.exp).toBe(123456);
            expect(result.sessionBinding).toBeDefined();
        });
    });
});
