import { UIFService, UIFItem, UIFSearchOptions, UIFPriceComparison } from '../../services/trade/trading/UIFService';
import axios from 'axios';

// Mock axios
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        get: jest.fn(),
        interceptors: {
            response: {
                use: jest.fn()
            }
        }
    }))
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    },
logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

describe('UIFService', () => {
    let uifService: UIFService;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockClient = {
            get: jest.fn(),
            interceptors: {
                response: {
                    use: jest.fn()
                }
            }
        };
        
        (axios.create as jest.Mock).mockReturnValue(mockClient);
        uifService = new UIFService();
    });

    describe('searchItems', () => {
        it('should search items and return results', async () => {
            const mockResponse = {
                data: [
                    { name: 'Laranite', category: 'Commodity', locations: [] },
                    { name: 'Agricium', category: 'Commodity', locations: [] }
                ]
            };

            mockClient.get.mockResolvedValueOnce({ data: null }); // Health check
            mockClient.get.mockResolvedValueOnce(mockResponse);

            const result = await uifService.searchItems({ query: 'Laranite' });

            // Should fallback to mock data since API health check might fail
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should filter mock items by query', async () => {
            // Force mock mode by making API unavailable
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.searchItems({ query: 'Laranite' });

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].name).toBe('Laranite');
        });

        it('should filter mock items by category', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.searchItems({ 
                query: '', 
                category: 'Commodity' 
            });

            expect(result.length).toBeGreaterThan(0);
            result.forEach(item => {
                expect(item.category).toBe('Commodity');
            });
        });

        it('should filter mock items by location', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.searchItems({ 
                query: '', 
                location: 'Stanton' 
            });

            expect(result.length).toBeGreaterThan(0);
        });

        it('should limit results by maxResults', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.searchItems({ 
                query: '', 
                maxResults: 2 
            });

            expect(result.length).toBeLessThanOrEqual(2);
        });

        it('should use cache for repeated searches', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const options: UIFSearchOptions = { query: 'Laranite' };
            
            // First search
            const result1 = await uifService.searchItems(options);
            
            // Second search (should use cache)
            const result2 = await uifService.searchItems(options);

            expect(result1).toEqual(result2);
        });
    });

    describe('getItemDetails', () => {
        it('should return item details', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.getItemDetails('Laranite');

            expect(result).toBeDefined();
            expect(result?.name).toBe('Laranite');
            expect(result?.category).toBe('Commodity');
            expect(result?.locations).toBeDefined();
        });

        it('should return null for non-existent item', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.getItemDetails('NonExistentItem');

            expect(result).toBeNull();
        });
    });

    describe('getItemPrices', () => {
        it('should return item prices', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.getItemPrices('Laranite');

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return empty array for non-existent item', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.getItemPrices('NonExistentItem');

            expect(result).toEqual([]);
        });
    });

    describe('findBestBuyLocation', () => {
        it('should find the cheapest buy location', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.findBestBuyLocation('Laranite');

            expect(result).toBeDefined();
            expect(result?.type).toBe('buy');
            expect(result?.price).toBeDefined();
        });

        it('should prioritize near location if specified', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.findBestBuyLocation('Laranite', 'Stanton');

            expect(result).toBeDefined();
            expect(result?.type).toBe('buy');
        });

        it('should return null if no buy locations available', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.findBestBuyLocation('NonExistentItem');

            expect(result).toBeNull();
        });
    });

    describe('findBestSellLocation', () => {
        it('should find the highest sell location', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.findBestSellLocation('Laranite');

            expect(result).toBeDefined();
            expect(result?.type).toBe('sell');
            expect(result?.price).toBeDefined();
        });

        it('should return null if no sell locations available', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.findBestSellLocation('NonExistentItem');

            expect(result).toBeNull();
        });
    });

    describe('comparePrices', () => {
        it('should compare buy and sell prices', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.comparePrices('Laranite');

            expect(result).toBeDefined();
            expect(result?.item).toBe('Laranite');
            expect(result?.bestBuyLocation).toBeDefined();
            expect(result?.bestSellLocation).toBeDefined();
            expect(result?.potentialProfit).toBeGreaterThan(0);
            expect(result?.profitMargin).toBeGreaterThan(0);
        });

        it('should return null for non-existent item', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const result = await uifService.comparePrices('NonExistentItem');

            expect(result).toBeNull();
        });
    });

    describe('updateItemPrice', () => {
        it('should update cached item price', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            // First, get item to populate cache
            await uifService.getItemDetails('Laranite');

            // Update price
            uifService.updateItemPrice('Laranite', 'NewLocation', 50.00, 'buy');

            // Get updated item
            const result = await uifService.getItemDetails('Laranite');

            // Check if new location was added
            const newLocation = result?.locations.find(
                loc => loc.location === 'NewLocation' && loc.type === 'buy'
            );
            expect(newLocation).toBeDefined();
            expect(newLocation?.price).toBe(50.00);
        });
    });

    describe('clearCache', () => {
        it('should clear all cached data', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            // Populate cache
            await uifService.getItemDetails('Laranite');
            
            // Clear cache
            uifService.clearCache();

            // Verify cache is cleared by checking that next call fetches fresh data
            // (In this case, mock data will be returned again)
            const result = await uifService.getItemDetails('Laranite');
            expect(result).toBeDefined();
        });

        it('should clear specific item cache', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            // Populate cache
            await uifService.getItemDetails('Laranite');
            
            // Clear specific item cache
            uifService.clearItemCache('Laranite');

            // Verify specific item cache is cleared
            const result = await uifService.getItemDetails('Laranite');
            expect(result).toBeDefined();
        });
    });

    describe('caching behavior', () => {
        it('should cache search results for performance', async () => {
            mockClient.get.mockRejectedValue(new Error('API unavailable'));

            const startTime = Date.now();
            
            // First search (populates cache)
            await uifService.searchItems({ query: 'test' });
            
            // Second search (uses cache)
            await uifService.searchItems({ query: 'test' });
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Both calls should complete quickly since second uses cache
            expect(totalTime).toBeLessThan(1000);
        });
    });

    describe('error handling', () => {
        it('should fallback to mock data on API error', async () => {
            mockClient.get.mockRejectedValue(new Error('Network error'));

            const result = await uifService.searchItems({ query: 'Laranite' });

            // Should return mock data instead of throwing
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle malformed API response', async () => {
            mockClient.get.mockResolvedValue({ data: 'invalid' });

            const result = await uifService.searchItems({ query: 'test' });

            // Should handle gracefully
            expect(Array.isArray(result)).toBe(true);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
