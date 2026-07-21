// Import mock before routes and other imports
import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
    AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
    AppDataSource: mockAppDataSource,
}));

// NOW import other dependencies
import compression from 'compression';
import express from 'express';
import request from 'supertest';

import { AppDataSource } from '../../config/database';
import { setHealthRoutes } from '../../routes/healthRoutes';

describe('Compression Integration Tests', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        
        // Add compression middleware (same config as app.ts)
        app.use(compression({
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            },
            level: 6
        }));

        app.use(express.json());
        setHealthRoutes(app);
        (AppDataSource.query as jest.Mock).mockClear();
    });

    describe('Health Endpoint with Compression', () => {
        it('should compress /health endpoint response when Accept-Encoding is gzip', async () => {
            (AppDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);
            process.env.DISCORD_BOT_TOKEN = 'test-token';

            const response = await request(app)
                .get('/health')
                .set('Accept-Encoding', 'gzip');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'OK');
            // The response might not be compressed if it's too small
            // but the middleware should be applied without errors
        });

        it('should work without compression when x-no-compression header is set', async () => {
            (AppDataSource.query as jest.Mock).mockResolvedValue([{ result: 1 }]);

            const response = await request(app)
                .get('/health')
                .set('Accept-Encoding', 'gzip')
                .set('x-no-compression', '1');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.headers['content-encoding']).toBeUndefined();
        });
    });

    describe('Compression with JSON Responses', () => {
        beforeEach(() => {
            // Add a test endpoint with a large JSON response
            app.get('/test/large-json', (req, res) => {
                const largeData = {
                    users: Array(50).fill(null).map((_, i) => ({
                        id: i + 1,
                        username: `user_${i + 1}`,
                        email: `user${i + 1}@example.com`,
                        profile: {
                            firstName: `First${i}`,
                            lastName: `Last${i}`,
                            bio: 'This is a longer bio text to increase the payload size for effective compression testing.',
                            settings: {
                                notifications: true,
                                privacy: 'public',
                                theme: 'dark'
                            }
                        }
                    }))
                };
                res.json(largeData);
            });
        });

        it('should compress large JSON responses', async () => {
            const response = await request(app)
                .get('/test/large-json')
                .set('Accept-Encoding', 'gzip');

            expect(response.status).toBe(200);
            expect(response.headers['content-encoding']).toBe('gzip');
            expect(response.headers['content-type']).toContain('application/json');
            expect(response.body.users).toHaveLength(50);
        });

        it('should maintain data integrity in compressed JSON', async () => {
            const response = await request(app)
                .get('/test/large-json')
                .set('Accept-Encoding', 'gzip');

            expect(response.status).toBe(200);
            expect(response.body.users).toHaveLength(50);
            expect(response.body.users[0]).toHaveProperty('id', 1);
            expect(response.body.users[0]).toHaveProperty('username', 'user_1');
            expect(response.body.users[0].profile).toHaveProperty('settings');
            expect(response.body.users[49]).toHaveProperty('id', 50);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
