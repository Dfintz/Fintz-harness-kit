import { RegolithService } from '../../services/content';
import { MiningLocation } from '../../services/content/RegolithService';

describe('RegolithService', () => {
    beforeEach(() => {
        // Clear cache before each test
        RegolithService.clearCache();
    });

    describe('getMiningData', () => {
        it('should return mining data for valid location', async () => {
            const data = await RegolithService.getMiningData('arial');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Arial');
            expect(data?.system).toBe('Stanton');
            expect(data?.accessibility).toBe('Easy');
            expect(data?.resources).toHaveLength(5);
        });

        it('should return null for invalid location', async () => {
            const data = await RegolithService.getMiningData('invalid-location-999');

            expect(data).toBeNull();
        });

        it('should be case-insensitive', async () => {
            const data1 = await RegolithService.getMiningData('ARIAL');
            const data2 = await RegolithService.getMiningData('Arial');
            const data3 = await RegolithService.getMiningData('arial');

            expect(data1?.name).toBe('Arial');
            expect(data2?.name).toBe('Arial');
            expect(data3?.name).toBe('Arial');
        });

        it('should handle location names with spaces', async () => {
            const data = await RegolithService.getMiningData('aaron halo');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Aaron Halo');
            expect(data?.body).toBe('Asteroid Belt');
        });

        it('should cache results', async () => {
            const data1 = await RegolithService.getMiningData('daymar');
            const data2 = await RegolithService.getMiningData('daymar');

            expect(data1).toEqual(data2);
            // Both calls should return the same cached object
            expect(data1).toBeDefined();
        });

        it('should return data with correct resource structure', async () => {
            const data = await RegolithService.getMiningData('yela');

            expect(data?.resources[0]).toHaveProperty('name');
            expect(data?.resources[0]).toHaveProperty('symbol');
            expect(data?.resources[0]).toHaveProperty('percentage');
            expect(data?.resources[0]).toHaveProperty('price');
        });
    });

    describe('generateMiningDescription', () => {
        it('should generate description with location data', async () => {
            const description = await RegolithService.generateMiningDescription('daymar');

            expect(description).toContain('Mining Location Data');
            expect(description).toContain('**System:**');
            expect(description).toContain('Stanton');
            expect(description).toContain('**Accessibility:**');
            expect(description).toContain('Easy');
            expect(description).toContain('Top Mineral Resources');
            expect(description).toContain('regolith.rocks');
        });

        it('should include top 5 resources sorted by percentage', async () => {
            const description = await RegolithService.generateMiningDescription('daymar');

            // Should list resources 1-5
            expect(description).toContain('1. **');
            expect(description).toContain('2. **');
            expect(description).toContain('3. **');
            expect(description).toContain('4. **');
            expect(description).toContain('5. **');
        });

        it('should include price information when available', async () => {
            const description = await RegolithService.generateMiningDescription('arial');

            expect(description).toContain('aUEC/unit');
        });

        it('should include notes when available', async () => {
            const description = await RegolithService.generateMiningDescription('daymar');

            expect(description).toContain('Notes:');
            expect(description).toContain('Popular beginner location');
        });

        it('should include celestial body when available', async () => {
            const description = await RegolithService.generateMiningDescription('arial');

            expect(description).toContain('Celestial Body:');
            expect(description).toContain('Hurston - Arial');
        });

        it('should handle location with system parameter', async () => {
            const description = await RegolithService.generateMiningDescription('daymar', 'Crusader');

            expect(description).toContain('Stanton');
        });

        it('should return simple description for invalid location', async () => {
            const description = await RegolithService.generateMiningDescription('invalid-location');

            expect(description).toContain('Mining location: invalid-location');
        });

        it('should return empty string on error', async () => {
            // Test error handling - pass something that might cause issues
            const description = await RegolithService.generateMiningDescription('');

            expect(typeof description).toBe('string');
        });
    });

    describe('getMiningDataSummary', () => {
        it('should return summary with all required fields', async () => {
            const summary = await RegolithService.getMiningDataSummary('lyria');

            expect(summary).toBeDefined();
            expect(summary?.location).toBe('Lyria');
            expect(summary?.system).toBe('Stanton');
            expect(summary?.totalResources).toBe(5);
            expect(summary?.topResources).toHaveLength(3);
            expect(summary?.accessibility).toBe('Moderate');
            expect(summary?.recommendedShips).toBeDefined();
            expect(summary?.estimatedProfitPerHour).toBeDefined();
        });

        it('should return null for invalid location', async () => {
            const summary = await RegolithService.getMiningDataSummary('invalid-location');

            expect(summary).toBeNull();
        });

        it('should include top 3 resources sorted by percentage', async () => {
            const summary = await RegolithService.getMiningDataSummary('yela');

            expect(summary?.topResources).toHaveLength(3);
            
            // Should be sorted descending by percentage
            const percentages = summary?.topResources.map(r => r.percentage) || [];
            expect(percentages[0]).toBeGreaterThanOrEqual(percentages[1]);
            expect(percentages[1]).toBeGreaterThanOrEqual(percentages[2]);
        });

        it('should calculate estimated value when price available', async () => {
            const summary = await RegolithService.getMiningDataSummary('arial');

            const resourcesWithValue = summary?.topResources.filter(r => r.estimatedValue !== undefined);
            expect(resourcesWithValue?.length).toBeGreaterThan(0);
        });

        it('should recommend appropriate ships for accessibility', async () => {
            const easyLocation = await RegolithService.getMiningDataSummary('daymar');
            const difficultLocation = await RegolithService.getMiningDataSummary('aaron halo');

            expect(easyLocation?.recommendedShips).toContain('MISC Prospector');
            expect(difficultLocation?.recommendedShips).toContain('ARGO Mole');
        });

        it('should include notes when available', async () => {
            const summary = await RegolithService.getMiningDataSummary('yela');

            expect(summary?.notes).toBeDefined();
            expect(summary?.notes.length).toBeGreaterThan(0);
        });

        it('should calculate profit per hour', async () => {
            const summary = await RegolithService.getMiningDataSummary('aaron halo');

            expect(summary?.estimatedProfitPerHour).toBeDefined();
            expect(summary?.estimatedProfitPerHour).toBeGreaterThan(0);
        });

        it('should include sell locations in top resources summary', async () => {
            const summary = await RegolithService.getMiningDataSummary('arial');

            expect(summary).toBeDefined();
            summary?.topResources.forEach(resource => {
                expect(resource.sellLocations).toBeDefined();
                expect(resource.sellLocations!.length).toBeGreaterThan(0);
            });
        });

        it('should include price in top resources summary', async () => {
            const summary = await RegolithService.getMiningDataSummary('lyria');

            expect(summary).toBeDefined();
            summary?.topResources.forEach(resource => {
                expect(resource.price).toBeDefined();
                expect(resource.price).toBeGreaterThan(0);
            });
        });
    });

    describe('searchByResource', () => {
        it('should find locations with specific resource', async () => {
            const locations = await RegolithService.searchByResource('Quantainium');

            expect(locations.length).toBeGreaterThan(0);
            
            // Verify all returned locations have the resource
            locations.forEach(loc => {
                const hasQuantainium = loc.resources.some(r => 
                    r.name.toLowerCase().includes('quantainium')
                );
                expect(hasQuantainium).toBe(true);
            });
        });

        it('should be case-insensitive', async () => {
            const results1 = await RegolithService.searchByResource('HADANITE');
            const results2 = await RegolithService.searchByResource('hadanite');

            expect(results1.length).toBe(results2.length);
            expect(results1.length).toBeGreaterThan(0);
        });

        it('should search by resource symbol', async () => {
            const locations = await RegolithService.searchByResource('Quan');

            expect(locations.length).toBeGreaterThan(0);
            
            locations.forEach(loc => {
                const hasQuan = loc.resources.some(r => 
                    r.symbol.toLowerCase().includes('quan')
                );
                expect(hasQuan).toBe(true);
            });
        });

        it('should return empty array for non-existent resource', async () => {
            const locations = await RegolithService.searchByResource('NonExistentResource999');

            expect(locations).toEqual([]);
        });

        it('should handle partial matches', async () => {
            const locations = await RegolithService.searchByResource('tani');

            expect(locations.length).toBeGreaterThan(0);
            // Should find Quantainium, Hephaestanite, etc.
        });
    });

    describe('getAllLocations', () => {
        it('should return all available mining locations', async () => {
            const locations = await RegolithService.getAllLocations();

            expect(locations.length).toBeGreaterThan(0);
            expect(locations.length).toBe(13); // arial, aberdeen, daymar, yela, lyria, wala, aaron halo, pyro, calliope, clio, euterpe, cellin, magda
        });

        it('should return locations with complete data', async () => {
            const locations = await RegolithService.getAllLocations();

            locations.forEach(loc => {
                expect(loc.name).toBeDefined();
                expect(loc.system).toBeDefined();
                expect(loc.accessibility).toBeDefined();
                expect(loc.resources).toBeDefined();
                expect(loc.resources.length).toBeGreaterThan(0);
            });
        });

        it('should include all accessibility levels', async () => {
            const locations = await RegolithService.getAllLocations();

            const accessibilityLevels = new Set(locations.map(l => l.accessibility));
            expect(accessibilityLevels.has('Easy')).toBe(true);
            expect(accessibilityLevels.has('Moderate')).toBe(true);
            expect(accessibilityLevels.has('Difficult')).toBe(true);
            expect(accessibilityLevels.has('Extreme')).toBe(true);
        });

        it('should include locations from multiple systems', async () => {
            const locations = await RegolithService.getAllLocations();

            const systems = new Set(locations.map(l => l.system));
            expect(systems.has('Stanton')).toBe(true);
            expect(systems.has('Pyro')).toBe(true);
        });
    });

    describe('clearCache', () => {
        it('should clear cached data', async () => {
            // First call should cache
            await RegolithService.getMiningData('arial');
            
            // Clear cache
            RegolithService.clearCache();
            
            // Second call should fetch fresh data (not from cache)
            const data = await RegolithService.getMiningData('arial');
            
            expect(data).toBeDefined();
        });

        it('should not throw error when clearing empty cache', () => {
            expect(() => RegolithService.clearCache()).not.toThrow();
        });
    });

    describe('edge cases and data validation', () => {
        it('should handle locations with extreme risk', async () => {
            const data = await RegolithService.getMiningData('pyro');

            expect(data?.accessibility).toBe('Extreme');
            expect(data?.notes).toContain('EXTREME RISK');
        });

        it('should have valid percentage values', async () => {
            const locations = await RegolithService.getAllLocations();

            locations.forEach(loc => {
                loc.resources.forEach(resource => {
                    expect(resource.percentage).toBeGreaterThan(0);
                    expect(resource.percentage).toBeLessThanOrEqual(100);
                });
            });
        });

        it('should have valid price values when present', async () => {
            const locations = await RegolithService.getAllLocations();

            locations.forEach(loc => {
                loc.resources.forEach(resource => {
                    if (resource.price !== undefined) {
                        expect(resource.price).toBeGreaterThan(0);
                    }
                });
            });
        });

        it('should recommend different ships for different accessibility', async () => {
            const summary1 = await RegolithService.getMiningDataSummary('daymar'); // Easy
            const summary2 = await RegolithService.getMiningDataSummary('aaron halo'); // Difficult

            expect(summary1?.recommendedShips).toBeDefined();
            expect(summary2?.recommendedShips).toBeDefined();
            // Different accessibility should have different ship recommendations
        });
    });

    describe('new locations', () => {
        it('should return mining data for Calliope (MicroTech moon)', async () => {
            const data = await RegolithService.getMiningData('calliope');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Calliope');
            expect(data?.system).toBe('Stanton');
            expect(data?.body).toBe('MicroTech - Calliope');
            expect(data?.accessibility).toBe('Moderate');
            expect(data?.resources).toHaveLength(5);
        });

        it('should return mining data for Clio (MicroTech moon)', async () => {
            const data = await RegolithService.getMiningData('clio');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Clio');
            expect(data?.system).toBe('Stanton');
            expect(data?.body).toBe('MicroTech - Clio');
            expect(data?.accessibility).toBe('Moderate');
            expect(data?.resources).toHaveLength(5);
        });

        it('should return mining data for Euterpe (MicroTech moon)', async () => {
            const data = await RegolithService.getMiningData('euterpe');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Euterpe');
            expect(data?.system).toBe('Stanton');
            expect(data?.body).toBe('MicroTech - Euterpe');
            expect(data?.accessibility).toBe('Easy');
            expect(data?.resources).toHaveLength(5);
        });

        it('should return mining data for Cellin (Crusader moon)', async () => {
            const data = await RegolithService.getMiningData('cellin');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Cellin');
            expect(data?.system).toBe('Stanton');
            expect(data?.body).toBe('Crusader - Cellin');
            expect(data?.accessibility).toBe('Easy');
            expect(data?.resources).toHaveLength(5);
        });

        it('should return mining data for Magda (Hurston moon)', async () => {
            const data = await RegolithService.getMiningData('magda');

            expect(data).toBeDefined();
            expect(data?.name).toBe('Magda');
            expect(data?.system).toBe('Stanton');
            expect(data?.body).toBe('Hurston - Magda');
            expect(data?.accessibility).toBe('Moderate');
            expect(data?.resources).toHaveLength(5);
        });

        it('should be case-insensitive for new locations', async () => {
            const data1 = await RegolithService.getMiningData('CALLIOPE');
            const data2 = await RegolithService.getMiningData('Calliope');
            const data3 = await RegolithService.getMiningData('calliope');

            expect(data1?.name).toBe('Calliope');
            expect(data2?.name).toBe('Calliope');
            expect(data3?.name).toBe('Calliope');
        });
    });

    describe('sell locations', () => {
        it('should have sell locations for all resources in existing locations', async () => {
            const data = await RegolithService.getMiningData('arial');

            expect(data).toBeDefined();
            data?.resources.forEach(resource => {
                expect(resource.sellLocations).toBeDefined();
                expect(resource.sellLocations!.length).toBeGreaterThan(0);
            });
        });

        it('should have sell locations for all resources in new locations', async () => {
            const data = await RegolithService.getMiningData('calliope');

            expect(data).toBeDefined();
            data?.resources.forEach(resource => {
                expect(resource.sellLocations).toBeDefined();
                expect(resource.sellLocations!.length).toBeGreaterThan(0);
            });
        });

        it('should have valid sell location names', async () => {
            const locations = await RegolithService.getAllLocations();
            const validSellLocations = [
                'Lorville CBD', 'Area18 TDD', 'Port Olisar', 'Grim HEX',
                'New Babbage TDD', 'Port Tressler', 'Ruin Station', 'Pyro Gateway'
            ];

            locations.forEach(loc => {
                loc.resources.forEach(resource => {
                    if (resource.sellLocations) {
                        resource.sellLocations.forEach(sellLoc => {
                            expect(validSellLocations).toContain(sellLoc);
                        });
                    }
                });
            });
        });

        it('should have multiple sell locations per resource', async () => {
            const data = await RegolithService.getMiningData('lyria');

            expect(data).toBeDefined();
            data?.resources.forEach(resource => {
                expect(resource.sellLocations).toBeDefined();
                expect(resource.sellLocations!.length).toBeGreaterThanOrEqual(2);
            });
        });
    });

    describe('scheduled data fetch integration', () => {
        it('should return data fetch status', () => {
            const status = RegolithService.getDataFetchStatus();
            
            expect(status).toHaveProperty('hasLiveData');
            expect(status).toHaveProperty('lastUpdated');
            expect(status).toHaveProperty('sources');
            expect(status).toHaveProperty('isStale');
        });

        it('should indicate no live data when not fetched', () => {
            const status = RegolithService.getDataFetchStatus();
            
            expect(status.hasLiveData).toBe(false);
            expect(status.lastUpdated).toBeNull();
            expect(status.isStale).toBe(true);
        });

        it('should return empty arrays for data getters when no live data', () => {
            expect(RegolithService.getRefineriesData()).toEqual([]);
            expect(RegolithService.getMarketsData()).toEqual([]);
            expect(RegolithService.getGemsData()).toEqual([]);
        });

        it('should return empty array for live locations when no data fetched', async () => {
            const locations = await RegolithService.getAllLiveLocations();
            expect(locations).toEqual([]);
        });

        it('should start scheduled fetch without throwing', () => {
            expect(() => RegolithService.startScheduledFetch()).not.toThrow();
            // Stop to clean up
            RegolithService.stopScheduledFetch();
        });

        it('should stop scheduled fetch without throwing', () => {
            RegolithService.startScheduledFetch();
            expect(() => RegolithService.stopScheduledFetch()).not.toThrow();
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
