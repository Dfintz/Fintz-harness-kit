import { Response, NextFunction } from 'express';

import { auditSensitiveDataAccess } from '../../middleware/auditMiddleware';
import { AuthRequest } from '../../middleware/auth';
import * as auditLogger from '../../utils/auditLogger';

// Mock audit logger
jest.mock('../../utils/auditLogger');

describe('Audit Middleware', () => {
    let mockRequest: any;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction;

    beforeEach(() => {
        mockRequest = {
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            headers: {
                'user-agent': 'Test Agent',
            },
            params: {},
            path: '',
            method: 'GET',
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        nextFunction = jest.fn();
        jest.clearAllMocks();
    });

    describe('auditSensitiveDataAccess', () => {
        it('should log access to specific user data', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };
            mockRequest.path = '/api/users/123';
            mockRequest.method = 'GET';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).toHaveBeenCalledWith(
                '1',
                'testuser',
                '/api/users/123',
                'READ',
                '127.0.0.1',
                'Test Agent',
                expect.objectContaining({
                    method: 'GET',
                })
            );
        });

        it('should log POST requests to sensitive resources', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };
            mockRequest.path = '/api/users';
            mockRequest.method = 'POST';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).toHaveBeenCalledWith(
                '1',
                'testuser',
                '/api/users',
                'CREATE',
                '127.0.0.1',
                'Test Agent',
                expect.any(Object)
            );
        });

        it('should log PUT requests to sensitive resources', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };
            mockRequest.path = '/api/users/123';
            mockRequest.method = 'PUT';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).toHaveBeenCalledWith(
                '1',
                'testuser',
                '/api/users/123',
                'UPDATE',
                '127.0.0.1',
                'Test Agent',
                expect.any(Object)
            );
        });

        it('should log DELETE requests to sensitive resources', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };
            mockRequest.path = '/api/organizations/456';
            mockRequest.method = 'DELETE';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).toHaveBeenCalledWith(
                '1',
                'testuser',
                '/api/organizations/456',
                'DELETE',
                '127.0.0.1',
                'Test Agent',
                expect.any(Object)
            );
        });

        it('should not log general GET requests to list endpoints', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };
            mockRequest.path = '/api/users';
            mockRequest.method = 'GET';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).not.toHaveBeenCalled();
        });

        it('should not log requests to non-sensitive resources', () => {
            mockRequest.user = { id: '1', username: 'testuser', role: 'user' };
            mockRequest.path = '/api/health';
            mockRequest.method = 'GET';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).not.toHaveBeenCalled();
        });

        it('should not log if user is not authenticated', () => {
            mockRequest.user = undefined;
            mockRequest.path = '/api/users/123';
            mockRequest.method = 'GET';

            auditSensitiveDataAccess(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

            expect(nextFunction).toHaveBeenCalled();
            expect(auditLogger.logSensitiveDataAccess).not.toHaveBeenCalled();
        });
    });
});
