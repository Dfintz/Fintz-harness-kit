/**
 * URL Configuration Tests
 * 
 * Tests environment-aware URL defaults to ensure proper redirects
 * in both development and production environments.
 */

import { getFrontendUrl } from '../urls';

describe('URL Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment before each test
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('getFrontendUrl', () => {
        it('should return FRONTEND_URL when explicitly set', () => {
            process.env.FRONTEND_URL = 'https://custom-domain.com';
            
            const result = getFrontendUrl();
            
            expect(result).toBe('https://custom-domain.com');
        });

        it('should return production URL when NODE_ENV is production and FRONTEND_URL not set', () => {
            delete process.env.FRONTEND_URL;
            process.env.NODE_ENV = 'production';
            
            const result = getFrontendUrl();
            
            expect(result).toBe('https://fringecore.space');
        });

        it('should return localhost URL when NODE_ENV is development and FRONTEND_URL not set', () => {
            delete process.env.FRONTEND_URL;
            process.env.NODE_ENV = 'development';
            
            const result = getFrontendUrl();
            
            expect(result).toBe('http://localhost:3001');
        });

        it('should return localhost URL when NODE_ENV is not set and FRONTEND_URL not set', () => {
            delete process.env.FRONTEND_URL;
            delete process.env.NODE_ENV;
            
            const result = getFrontendUrl();
            
            expect(result).toBe('http://localhost:3001');
        });

        it('should return localhost URL when NODE_ENV is test and FRONTEND_URL not set', () => {
            delete process.env.FRONTEND_URL;
            process.env.NODE_ENV = 'test';
            
            const result = getFrontendUrl();
            
            expect(result).toBe('http://localhost:3001');
        });

        it('should prioritize FRONTEND_URL over NODE_ENV', () => {
            process.env.FRONTEND_URL = 'https://override.com';
            process.env.NODE_ENV = 'production';
            
            const result = getFrontendUrl();
            
            expect(result).toBe('https://override.com');
        });
    });
});
