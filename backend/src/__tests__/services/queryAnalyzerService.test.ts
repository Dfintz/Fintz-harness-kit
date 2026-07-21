import { QueryAnalyzerService } from '../../services/monitoring/QueryAnalyzerService';

describe('QueryAnalyzerService', () => {
    let queryAnalyzer: QueryAnalyzerService;

    beforeEach(() => {
        queryAnalyzer = new QueryAnalyzerService({
            maxHistorySize: 100,
            slowQueryThreshold: 50
        });
    });

    afterEach(() => {
        queryAnalyzer.clearHistory();
    });

    describe('recordQuery', () => {
        it('should record a query execution', () => {
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE id = $1',
                duration: 25,
                timestamp: new Date()
            });

            const recentQueries = queryAnalyzer.getRecentQueries(10);
            expect(recentQueries).toHaveLength(1);
            expect(recentQueries[0].query).toContain('SELECT');
            expect(recentQueries[0].duration).toBe(25);
        });

        it('should identify slow queries', () => {
            // Record a slow query (above 50ms threshold)
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM activities WHERE status = $1',
                duration: 100,
                timestamp: new Date()
            });

            const stats = queryAnalyzer.getQueryStats();
            expect(stats.slowQueryCount).toBe(1);
        });

        it('should maintain max history size', () => {
            // Record 150 queries (max is 100)
            for (let i = 0; i < 150; i++) {
                queryAnalyzer.recordQuery({
                    query: `SELECT * FROM users WHERE id = ${i}`,
                    duration: 10,
                    timestamp: new Date()
                });
            }

            const recentQueries = queryAnalyzer.getRecentQueries(200);
            expect(recentQueries.length).toBeLessThanOrEqual(100);
        });
    });

    describe('measureQuery', () => {
        it('should measure and record query execution time', async () => {
            const result = await queryAnalyzer.measureQuery(
                async () => {
                    await new Promise(resolve => setTimeout(resolve, 15));
                    return { data: 'test' };
                },
                'SELECT * FROM users'
            );

            expect(result).toEqual({ data: 'test' });
            
            const recentQueries = queryAnalyzer.getRecentQueries(1);
            // Use >= 10 with 15ms sleep to account for timing precision variations
            expect(recentQueries[0].duration).toBeGreaterThanOrEqual(10);
        });

        it('should record query even if it throws an error', async () => {
            await expect(
                queryAnalyzer.measureQuery(
                    async () => {
                        throw new Error('Query failed');
                    },
                    'SELECT * FROM bad_query'
                )
            ).rejects.toThrow('Query failed');

            const recentQueries = queryAnalyzer.getRecentQueries(1);
            expect(recentQueries).toHaveLength(1);
        });
    });

    describe('getQueryStats', () => {
        it('should return empty stats when no queries recorded', () => {
            const stats = queryAnalyzer.getQueryStats();
            
            expect(stats.totalQueries).toBe(0);
            expect(stats.averageDuration).toBe(0);
            expect(stats.slowQueryCount).toBe(0);
        });

        it('should calculate correct statistics', () => {
            // Record queries with known durations
            const durations = [10, 20, 30, 40, 100];
            durations.forEach(duration => {
                queryAnalyzer.recordQuery({
                    query: 'SELECT * FROM users',
                    duration,
                    timestamp: new Date()
                });
            });

            const stats = queryAnalyzer.getQueryStats();
            
            expect(stats.totalQueries).toBe(5);
            expect(stats.averageDuration).toBe(40); // (10+20+30+40+100)/5
            expect(stats.minDuration).toBe(10);
            expect(stats.maxDuration).toBe(100);
            expect(stats.slowQueryCount).toBe(1); // Only 100ms is above 50ms threshold
        });

        it('should calculate percentile durations correctly', () => {
            // Record 100 queries with durations 1-100
            for (let i = 1; i <= 100; i++) {
                queryAnalyzer.recordQuery({
                    query: 'SELECT * FROM users',
                    duration: i,
                    timestamp: new Date()
                });
            }

            const stats = queryAnalyzer.getQueryStats();
            
            expect(stats.p50Duration).toBe(50);
            expect(stats.p95Duration).toBe(95);
            expect(stats.p99Duration).toBe(99);
        });

        it('should track queries by table', () => {
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE id = $1',
                duration: 10,
                timestamp: new Date()
            });
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE name = $1',
                duration: 15,
                timestamp: new Date()
            });
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM fleets WHERE org = $1',
                duration: 20,
                timestamp: new Date()
            });

            const stats = queryAnalyzer.getQueryStats();
            
            expect(stats.queriesByTable['users']).toBe(2);
            expect(stats.queriesByTable['fleets']).toBe(1);
        });
    });

    describe('analyzeSlowQueries', () => {
        it('should return empty array when no slow queries', () => {
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users',
                duration: 10,
                timestamp: new Date()
            });

            const analysis = queryAnalyzer.analyzeSlowQueries();
            expect(analysis).toHaveLength(0);
        });

        it('should analyze and group slow queries by pattern', () => {
            // Record slow queries with same pattern but different parameters
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE id = 1',
                duration: 100,
                timestamp: new Date()
            });
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE id = 2',
                duration: 150,
                timestamp: new Date()
            });
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE id = 3',
                duration: 80,
                timestamp: new Date()
            });

            const analysis = queryAnalyzer.analyzeSlowQueries();
            
            expect(analysis.length).toBeGreaterThanOrEqual(1);
            expect(analysis[0].executionCount).toBe(3);
            expect(analysis[0].averageDuration).toBeCloseTo(110, 0);
        });

        it('should sort analysis by average duration descending', () => {
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users WHERE id = 1',
                duration: 100,
                timestamp: new Date()
            });
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM fleets WHERE org = 1',
                duration: 200,
                timestamp: new Date()
            });

            const analysis = queryAnalyzer.analyzeSlowQueries();
            
            expect(analysis[0].averageDuration).toBeGreaterThan(analysis[1].averageDuration);
        });

        it('should provide suggestions for slow queries', () => {
            queryAnalyzer.recordQuery({
                query: "SELECT * FROM users WHERE name LIKE '%test%'",
                duration: 500,
                timestamp: new Date()
            });

            const analysis = queryAnalyzer.analyzeSlowQueries();
            
            expect(analysis[0].suggestion).toContain('full-text search');
        });
    });

    describe('getIndexRecommendations', () => {
        it('should recommend indices for frequently queried columns', () => {
            // Record many queries with same WHERE column
            for (let i = 0; i < 20; i++) {
                queryAnalyzer.recordQuery({
                    query: `SELECT * FROM users WHERE organizationId = '${i}'`,
                    duration: 30,
                    timestamp: new Date()
                });
            }

            const recommendations = queryAnalyzer.getIndexRecommendations();
            
            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations[0].table).toBe('users');
            expect(recommendations[0].columns).toContain('organizationid');
        });
    });

    describe('clearHistory', () => {
        it('should clear all query history', () => {
            queryAnalyzer.recordQuery({
                query: 'SELECT * FROM users',
                duration: 10,
                timestamp: new Date()
            });

            queryAnalyzer.clearHistory();

            expect(queryAnalyzer.getRecentQueries()).toHaveLength(0);
            expect(queryAnalyzer.getQueryStats().totalQueries).toBe(0);
        });
    });

    describe('getRecentQueries', () => {
        it('should return limited number of recent queries', () => {
            for (let i = 0; i < 50; i++) {
                queryAnalyzer.recordQuery({
                    query: `SELECT * FROM users WHERE id = ${i}`,
                    duration: 10,
                    timestamp: new Date()
                });
            }

            const recent5 = queryAnalyzer.getRecentQueries(5);
            const recent10 = queryAnalyzer.getRecentQueries(10);

            expect(recent5).toHaveLength(5);
            expect(recent10).toHaveLength(10);
        });

        it('should return all queries if limit exceeds history', () => {
            for (let i = 0; i < 3; i++) {
                queryAnalyzer.recordQuery({
                    query: `SELECT * FROM users WHERE id = ${i}`,
                    duration: 10,
                    timestamp: new Date()
                });
            }

            const recentQueries = queryAnalyzer.getRecentQueries(100);
            expect(recentQueries).toHaveLength(3);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
