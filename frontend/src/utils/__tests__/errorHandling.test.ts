/**
 * Error Handling Utility Tests
 */

import { handleFetchError, getAuthErrorMessage } from '@/utils/errorHandling';

// Mock the config/env module
jest.mock('../../config/env', () => ({
    getBackendUrl: jest.fn(() => 'http://localhost:3001')
}));

describe('errorHandling utils', () => {
    beforeEach(() => {
        // Clear console.error mock
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('handleFetchError', () => {
        it('should handle network errors (Failed to fetch)', () => {
            const error = new TypeError('Failed to fetch');
            const result = handleFetchError(error, 'Test request');

            expect(result.isNetworkError).toBe(true);
            expect(result.message).toContain('Cannot connect to backend server');
            expect(result.message).toContain('http://localhost:3001');
            expect(result.backendUrl).toBe('http://localhost:3001');
        });

        it('should handle standard Error instances', () => {
            const error = new Error('Something went wrong');
            const result = handleFetchError(error, 'Test request');

            expect(result.isNetworkError).toBe(false);
            expect(result.message).toBe('Something went wrong');
            expect(result.backendUrl).toBeUndefined();
        });

        it('should handle unknown error types', () => {
            const error = { unknown: 'error' };
            const result = handleFetchError(error, 'Test request');

            expect(result.isNetworkError).toBe(false);
            expect(result.message).toBe('Test request failed');
            expect(result.backendUrl).toBeUndefined();
        });

        it('should use default context when not provided', () => {
            const error = { unknown: 'error' };
            const result = handleFetchError(error);

            expect(result.message).toBe('Request failed');
        });

        it('should log diagnostic information for network errors', () => {
            const consoleSpy = jest.spyOn(console, 'error');
            const error = new TypeError('Failed to fetch');
            
            handleFetchError(error, 'Authentication');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[ERROR] Authentication - Backend connection failed',
                error,
                expect.objectContaining({
                    backendUrl: 'http://localhost:3001'
                })
            );
        });

        it('should handle TypeError that is not a network error', () => {
            const error = new TypeError('Some other type error');
            const result = handleFetchError(error, 'Test');

            expect(result.isNetworkError).toBe(false);
            expect(result.message).toBe('Some other type error');
        });

        it('should handle null error', () => {
            const result = handleFetchError(null, 'Null test');

            expect(result.isNetworkError).toBe(false);
            expect(result.message).toBe('Null test failed');
        });

        it('should handle undefined error', () => {
            const result = handleFetchError(undefined, 'Undefined test');

            expect(result.isNetworkError).toBe(false);
            expect(result.message).toBe('Undefined test failed');
        });
    });

    describe('getAuthErrorMessage', () => {
        it('should return error message for network authentication failure', () => {
            const error = new TypeError('Failed to fetch');
            const message = getAuthErrorMessage(error, 'Discord');

            expect(message).toContain('Cannot connect to backend server');
            expect(message).toContain('http://localhost:3001');
        });

        it('should return error message for standard error', () => {
            const error = new Error('Invalid credentials');
            const message = getAuthErrorMessage(error, 'Azure AD');

            expect(message).toBe('Invalid credentials');
        });

        it('should return formatted message for unknown error', () => {
            const error = { code: 500 };
            const message = getAuthErrorMessage(error, 'Demo');

            expect(message).toBe('Demo authentication failed');
        });

        it('should handle different authentication types', () => {
            const error = { unknown: 'error' };
            
            const discordMessage = getAuthErrorMessage(error, 'Discord');
            expect(discordMessage).toBe('Discord authentication failed');

            const azureMessage = getAuthErrorMessage(error, 'Azure AD');
            expect(azureMessage).toBe('Azure AD authentication failed');

            const rsiMessage = getAuthErrorMessage(error, 'RSI');
            expect(rsiMessage).toBe('RSI authentication failed');
        });
    });
});
