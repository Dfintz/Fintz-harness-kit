import { queryCacheService } from '../../services/infrastructure';

describe('QueryCacheService', () => {
    beforeEach(() => {
        // Clear cache before each test
        queryCacheService.flushAll();
    });

    describe('get and set', () => {
        it('should store and retrieve a value', () => {
            queryCacheService.set('test:key', { data: 'value' });
            const result = queryCacheService.get('test:key');
            expect(result).toEqual({ data: 'value' });
        });

        it('should return undefined for non-existent keys', () => {
            const result = queryCacheService.get('non:existent');
            expect(result).toBeUndefined();
        });

        it('should store different types of values', () => {
            queryCacheService.set('string:key', 'test');
            queryCacheService.set('number:key', 42);
            queryCacheService.set('array:key', [1, 2, 3]);
            queryCacheService.set('object:key', { foo: 'bar' });

            expect(queryCacheService.get('string:key')).toBe('test');
            expect(queryCacheService.get('number:key')).toBe(42);
            expect(queryCacheService.get('array:key')).toEqual([1, 2, 3]);
            expect(queryCacheService.get('object:key')).toEqual({ foo: 'bar' });
        });

        it('should respect custom TTL', (done) => {
            queryCacheService.set('expire:key', 'value', 1); // 1 second TTL
            
            // Should exist immediately
            expect(queryCacheService.get('expire:key')).toBe('value');
            
            // Should expire after 1 second
            setTimeout(() => {
                expect(queryCacheService.get('expire:key')).toBeUndefined();
                done();
            }, 1100);
        }, 2000);
    });

    describe('del', () => {
        it('should delete a cached value', () => {
            queryCacheService.set('test:key', 'value');
            expect(queryCacheService.get('test:key')).toBe('value');
            
            queryCacheService.del('test:key');
            expect(queryCacheService.get('test:key')).toBeUndefined();
        });

        it('should return number of deleted keys', () => {
            queryCacheService.set('test:key', 'value');
            const deleted = queryCacheService.del('test:key');
            expect(deleted).toBe(1);
        });

        it('should return 0 for non-existent keys', () => {
            const deleted = queryCacheService.del('non:existent');
            expect(deleted).toBe(0);
        });
    });

    describe('delPattern', () => {
        it('should delete all keys matching a pattern', () => {
            queryCacheService.set('user:1', { id: 1 });
            queryCacheService.set('user:2', { id: 2 });
            queryCacheService.set('user:3', { id: 3 });
            queryCacheService.set('event:1', { id: 1 });

            const deleted = queryCacheService.delPattern('user:*');
            expect(deleted).toBe(3);

            expect(queryCacheService.get('user:1')).toBeUndefined();
            expect(queryCacheService.get('user:2')).toBeUndefined();
            expect(queryCacheService.get('user:3')).toBeUndefined();
            expect(queryCacheService.get('event:1')).toEqual({ id: 1 });
        });

        it('should return 0 if no keys match pattern', () => {
            queryCacheService.set('user:1', { id: 1 });
            const deleted = queryCacheService.delPattern('event:*');
            expect(deleted).toBe(0);
        });
    });

    describe('flushAll', () => {
        it('should clear all cached values', () => {
            queryCacheService.set('key1', 'value1');
            queryCacheService.set('key2', 'value2');
            queryCacheService.set('key3', 'value3');

            queryCacheService.flushAll();

            expect(queryCacheService.get('key1')).toBeUndefined();
            expect(queryCacheService.get('key2')).toBeUndefined();
            expect(queryCacheService.get('key3')).toBeUndefined();
        });
    });

    describe('wrap', () => {
        it('should execute query on cache miss', async () => {
            const queryFn = jest.fn(async () => ({ data: 'test' }));
            
            const result = await queryCacheService.wrap('test:key', queryFn);
            
            expect(result).toEqual({ data: 'test' });
            expect(queryFn).toHaveBeenCalledTimes(1);
        });

        it('should return cached value on cache hit', async () => {
            const queryFn = jest.fn(async () => ({ data: 'test' }));
            
            // First call - cache miss
            await queryCacheService.wrap('test:key', queryFn);
            
            // Second call - cache hit
            const result = await queryCacheService.wrap('test:key', queryFn);
            
            expect(result).toEqual({ data: 'test' });
            expect(queryFn).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should cache result for subsequent calls', async () => {
            let callCount = 0;
            const queryFn = async () => {
                callCount++;
                return { count: callCount };
            };

            const result1 = await queryCacheService.wrap('test:key', queryFn);
            const result2 = await queryCacheService.wrap('test:key', queryFn);
            const result3 = await queryCacheService.wrap('test:key', queryFn);

            expect(result1).toEqual({ count: 1 });
            expect(result2).toEqual({ count: 1 }); // Same as first
            expect(result3).toEqual({ count: 1 }); // Same as first
        });

        it('should respect custom TTL', (done) => {
            let callCount = 0;
            const queryFn = async () => {
                callCount++;
                return { count: callCount };
            };

            // First call with 1 second TTL
            queryCacheService.wrap('test:key', queryFn, 1).then(() => {
                expect(callCount).toBe(1);

                // Wait for expiry
                setTimeout(() => {
                    queryCacheService.wrap('test:key', queryFn, 1).then(() => {
                        expect(callCount).toBe(2); // Called again after expiry
                        done();
                    });
                }, 1100);
            });
        }, 2000);
    });

    describe('getStats', () => {
        it('should return cache statistics', () => {
            queryCacheService.set('key1', 'value1');
            queryCacheService.set('key2', 'value2');
            queryCacheService.get('key1'); // Hit
            queryCacheService.get('non:existent'); // Miss

            const stats = queryCacheService.getStats();
            
            expect(stats.keys).toBe(2);
            expect(stats.hits).toBeGreaterThan(0);
            expect(stats.misses).toBeGreaterThan(0);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
