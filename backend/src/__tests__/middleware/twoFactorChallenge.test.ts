/**
 * Tests for Two-Factor Challenge Middleware
 */

import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/auth';
import {
    twoFactorChallengeMiddleware,
    TwoFactorChallengeConfig
} from '../../middleware/twoFactorChallenge';

// Mock dependencies
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

jest.mock('../../services/user', () => ({
    UserService: jest.fn().mockImplementation(() => ({
        getUserById: jest.fn()
    }))
}));

jest.mock('../../services/authentication/TwoFactorService', () => ({
    TwoFactorService: jest.fn().mockImplementation(() => ({
        verifyToken: jest.fn()
    }))
}));

import { UserService } from '../../services/user';
import { TwoFactorService } from '../../services/authentication/TwoFactorService';

describe('Two-Factor Challenge Middleware', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;
    let mockUserService: jest.Mocked<UserService>;
    let mockTwoFactorService: jest.Mocked<TwoFactorService>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnThis();

        mockReq = {
            path: '/api/admin/action',
            method: 'POST',
            headers: {},
            user: undefined
        };
        mockRes = {
            status: statusMock,
            json: jsonMock
        };
        mockNext = jest.fn();

        // Reset mock implementations
        mockUserService = new UserService() as jest.Mocked<UserService>;
        mockTwoFactorService = new TwoFactorService() as jest.Mocked<TwoFactorService>;
    });

    describe('twoFactorChallengeMiddleware', () => {
        it('should return 401 when user is not authenticated', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Authentication required'
            }));
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should skip validation for non-sensitive actions', async () => {
            const middleware = twoFactorChallengeMiddleware('not-a-sensitive-action');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'user' };

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should skip validation for roles in skipForRoles', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin', {
                skipForRoles: ['superadmin']
            });
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'superadmin' };

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should return 401 when user is not found', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue(null)
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: 'User not found'
            }));
        });

        it('should skip 2FA when user does not have 2FA enabled and not required', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin', {
                requireEnabled: false
            });
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: false
                })
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should require 2FA code when user has 2FA enabled', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            mockReq.headers = {};
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: true,
                    twoFactorSecret: 'secret123'
                })
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: '2FA verification required',
                code: '2FA_REQUIRED',
                action: 'cross-tenant-admin'
            }));
        });

        it('should return 403 when 2FA secret is not configured', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            mockReq.headers = { 'x-2fa-code': '123456' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: true,
                    twoFactorSecret: null
                })
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: '2FA not configured',
                code: '2FA_NOT_CONFIGURED'
            }));
        });

        it('should return 403 when 2FA code is invalid', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            mockReq.headers = { 'x-2fa-code': '123456' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: true,
                    twoFactorSecret: 'secret123'
                })
            }));
            
            (TwoFactorService as jest.Mock).mockImplementation(() => ({
                verifyToken: jest.fn().mockReturnValue(false)
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Invalid 2FA code',
                code: '2FA_INVALID'
            }));
        });

        it('should call next() when 2FA code is valid', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            mockReq.headers = { 'x-2fa-code': '123456' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: true,
                    twoFactorSecret: 'secret123'
                })
            }));
            
            (TwoFactorService as jest.Mock).mockImplementation(() => ({
                verifyToken: jest.fn().mockReturnValue(true)
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(statusMock).not.toHaveBeenCalled();
        });

        it('should accept custom code header name', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin', {
                codeHeader: 'X-Custom-2FA'
            });
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            mockReq.headers = { 'x-custom-2fa': '123456' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: true,
                    twoFactorSecret: 'secret123'
                })
            }));
            
            (TwoFactorService as jest.Mock).mockImplementation(() => ({
                verifyToken: jest.fn().mockReturnValue(true)
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin');
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockRejectedValue(new Error('Database error'))
            }));

            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Internal server error',
                message: 'Failed to validate 2FA'
            }));
        });
    });

    describe('sensitive actions', () => {
        const sensitiveActions = [
            'cross-tenant-admin',
            'user-delete',
            'organization-delete',
            'permission-grant-admin',
            'security-settings-change',
            'gdpr-data-deletion'
        ];

        sensitiveActions.forEach(action => {
            it(`should require 2FA for ${action} action`, async () => {
                const middleware = twoFactorChallengeMiddleware(action);
                mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
                mockReq.headers = {};
                
                (UserService as jest.Mock).mockImplementation(() => ({
                    getUserById: jest.fn().mockResolvedValue({
                        id: 'user-1',
                        twoFactorEnabled: true,
                        twoFactorSecret: 'secret123'
                    })
                }));

                await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

                expect(statusMock).toHaveBeenCalledWith(403);
                expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                    code: '2FA_REQUIRED',
                    action
                }));
            });
        });
    });

    describe('code reuse within window', () => {
        it('should allow same code reuse within window', async () => {
            const middleware = twoFactorChallengeMiddleware('cross-tenant-admin', {
                codeReuseWindow: 30
            });
            mockReq.user = { id: 'user-1', username: 'testuser', role: 'admin' };
            mockReq.headers = { 'x-2fa-code': '123456' };
            
            (UserService as jest.Mock).mockImplementation(() => ({
                getUserById: jest.fn().mockResolvedValue({
                    id: 'user-1',
                    twoFactorEnabled: true,
                    twoFactorSecret: 'secret123'
                })
            }));
            
            (TwoFactorService as jest.Mock).mockImplementation(() => ({
                verifyToken: jest.fn().mockReturnValue(true)
            }));

            // First call
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
            
            // Reset next
            mockNext = jest.fn();
            
            // Second call with same code should also pass
            await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('pre-configured middlewares', () => {
        it('should export crossTenantAdmin2faChallenge', () => {
            const { crossTenantAdmin2faChallenge } = require('../../middleware/twoFactorChallenge');
            expect(crossTenantAdmin2faChallenge).toBeDefined();
            expect(typeof crossTenantAdmin2faChallenge).toBe('function');
        });

        it('should export gdprDeletion2faChallenge', () => {
            const { gdprDeletion2faChallenge } = require('../../middleware/twoFactorChallenge');
            expect(gdprDeletion2faChallenge).toBeDefined();
            expect(typeof gdprDeletion2faChallenge).toBe('function');
        });

        it('should export securitySettings2faChallenge', () => {
            const { securitySettings2faChallenge } = require('../../middleware/twoFactorChallenge');
            expect(securitySettings2faChallenge).toBeDefined();
            expect(typeof securitySettings2faChallenge).toBe('function');
        });
    });
});
