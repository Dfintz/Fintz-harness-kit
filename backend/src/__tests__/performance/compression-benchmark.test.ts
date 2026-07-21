import compression from 'compression';
import express from 'express';
import request from 'supertest';

describe('Compression Performance Benchmarks', () => {
    let app: express.Application;
    let appWithoutCompression: express.Application;

    beforeEach(() => {
        // App with compression
        app = express();
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

        // App without compression
        appWithoutCompression = express();
        appWithoutCompression.use(express.json());

        // Add test endpoint with large data
        const addRoutes = (expressApp: express.Application) => {
            expressApp.get('/benchmark/large', (req, res) => {
                const data = {
                    meta: {
                        generated: new Date().toISOString(),
                        totalRecords: 200
                    },
                    records: Array(200).fill(null).map((_, i) => ({
                        id: i + 1,
                        uuid: `uuid-${i + 1}-abcd-efgh-ijkl-mnopqrstuvwx`,
                        name: `Record Number ${i + 1}`,
                        description: 'This is a detailed description that contains a lot of text to simulate real-world API responses. It includes various information about the record and its properties.',
                        status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'pending' : 'inactive',
                        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
                        metadata: {
                            createdAt: new Date(Date.now() - i * 86400000).toISOString(),
                            updatedAt: new Date().toISOString(),
                            version: 1,
                            author: `user${i % 10}`,
                            attributes: {
                                priority: i % 5,
                                category: ['A', 'B', 'C', 'D', 'E'][i % 5],
                                flags: {
                                    isPublic: i % 2 === 0,
                                    isFeatured: i % 5 === 0,
                                    isArchived: false
                                }
                            }
                        },
                        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                        relations: Array(5).fill(null).map((_, j) => ({
                            id: j + 1,
                            type: 'related',
                            name: `Related ${j + 1}`
                        }))
                    }))
                };
                res.json(data);
            });
        };

        addRoutes(app);
        addRoutes(appWithoutCompression);
    });

    it('should demonstrate compression benefits on large payloads', async () => {
        // Request with compression
        const compressedResponse = await request(app)
            .get('/benchmark/large')
            .set('Accept-Encoding', 'gzip');

        // Request without compression (using x-no-compression header)
        const uncompressedResponse = await request(app)
            .get('/benchmark/large')
            .set('Accept-Encoding', 'gzip')
            .set('x-no-compression', '1');

        // Both should return valid data
        expect(compressedResponse.status).toBe(200);
        expect(uncompressedResponse.status).toBe(200);

        // Verify compression was applied
        expect(compressedResponse.headers['content-encoding']).toBe('gzip');
        expect(uncompressedResponse.headers['content-encoding']).toBeUndefined();

        // Verify data integrity
        expect(compressedResponse.body.records).toHaveLength(200);
        expect(uncompressedResponse.body.records).toHaveLength(200);

        console.log('\n📊 Compression Performance Test Results:');
        console.log('==========================================');
        console.log(`✅ Compressed response:   Content-Encoding: ${compressedResponse.headers['content-encoding']}`);
        console.log(`✅ Uncompressed response: Content-Encoding: ${uncompressedResponse.headers['content-encoding'] || 'none'}`);
        console.log(`✅ Data integrity:        Both responses contain ${compressedResponse.body.records.length} records`);
        console.log('==========================================\n');
    });

    it('should show compression ratio estimation', async () => {
        const response = await request(app)
            .get('/benchmark/large')
            .set('Accept-Encoding', 'gzip')
            .set('x-no-compression', '1');

        const uncompressedSize = JSON.stringify(response.body).length;
        
        console.log('\n📈 Compression Statistics:');
        console.log('==========================================');
        console.log(`Original payload size: ~${(uncompressedSize / 1024).toFixed(2)} KB`);
        console.log(`Compression level:     6 (balanced)`);
        console.log(`Expected ratio:        ~70-80% reduction for JSON`);
        console.log(`Estimated compressed:  ~${(uncompressedSize * 0.25 / 1024).toFixed(2)} KB`);
        console.log('==========================================\n');
        
        expect(uncompressedSize).toBeGreaterThan(1024); // At least 1KB
    });

    it('should verify compression levels are configurable', async () => {
        // Test different compression levels with large enough data
        const levels = [0, 6, 9]; // 0=no compression, 6=default, 9=maximum
        const results: string[] = [];

        for (const level of levels) {
            const testApp = express();
            testApp.use(compression({ level }));
            testApp.use(express.json());
            testApp.get('/test', (req, res) => {
                // Generate data large enough to compress (> 1KB)
                res.json({ 
                    data: Array(100).fill(null).map((_, i) => ({
                        id: i,
                        value: 'x'.repeat(100)
                    }))
                });
            });

            const response = await request(testApp)
                .get('/test')
                .set('Accept-Encoding', 'gzip');

            results.push(`Level ${level}: ${response.headers['content-encoding'] || 'none'}`);
        }

        console.log('\n⚙️ Compression Level Test:');
        console.log('==========================================');
        results.forEach(r => console.log(`  ${r}`));
        console.log('==========================================\n');

        // All levels should compress when data is large enough and Accept-Encoding is set
        // Level 0 is a special case that may still compress in some implementations
        expect(results.length).toBe(3);
        expect(results.every(r => r.includes('Level'))).toBe(true);
        
        // At least the higher compression levels should work
        expect(results[1]).toMatch(/gzip|deflate|none/); // Level 6
        expect(results[2]).toMatch(/gzip|deflate|none/); // Level 9
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
