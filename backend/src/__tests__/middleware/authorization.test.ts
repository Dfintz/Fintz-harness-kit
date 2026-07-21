import { Response, NextFunction } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { requireRole, requireAdmin, requireModerator } from '../../middleware/authorization';
import * as auditLogger from '../../utils/auditLogger';

// Mock audit logger
jest.mock('../../utils/auditLogger');

describe('Authorization Middleware', () => {
    let mockRequest: Partial<AuthRequest>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockRequest = {
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' } as any,
            path: '/api/admin',
            method: 'GET',
            headers: {
                'user-agent': 'Test Agent',
            },
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();
        jest.clearAllMocks();
    });

    describe('requireRole', () => {
        it('should call next() if user has the required role', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'admin' };

            const middleware = requireRole(['admin', 'moderator']);
            middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should return 403 if user does not have the required role', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };

            const middleware = requireRole(['admin']);
            middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
            expect(nextFunction).not.toHaveBeenCalled();
            expect(auditLogger.logAuthorizationFailure).toHaveBeenCalledWith(
                '1',
                'testuser',
                'user',
                '/api/admin',
                'GET',
                '127.0.0.1',
                'Test Agent'
            );
        });

        it('should return 401 if user is not authenticated', () => {
            mockRequest.user = undefined;

            const middleware = requireRole(['admin']);
            middleware(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Authentication required' });
            expect(nextFunction).not.toHaveBeenCalled();
        });
    });

    describe('requireAdmin', () => {
        it('should allow admin users', () => {
            mockRequest.user = { id: '1', username: 'admin', role: 'admin' };

            requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should deny non-admin users', () => {
            mockRequest.user = { id: '2', username: 'user', role: 'user' };

            requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(nextFunction).not.toHaveBeenCalled();
            expect(auditLogger.logAuthorizationFailure).toHaveBeenCalled();
        });
    });

    describe('requireModerator', () => {
        it('should allow admin users', () => {
            mockRequest.user = { id: '1', username: 'admin', role: 'admin' };

            requireModerator(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should allow moderator users', () => {
            mockRequest.user = { id: '2', username: 'mod', role: 'moderator' };

            requireModerator(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
        });

        it('should deny regular users', () => {
            mockRequest.user = { id: '3', username: 'user', role: 'user' };

            requireModerator(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(nextFunction).not.toHaveBeenCalled();
            expect(auditLogger.logAuthorizationFailure).toHaveBeenCalled();
        });
    });
});
