import axios from 'axios';
import { ErkulComponent, ErkulGamesService } from '../../services/external/ErkulGamesService';

// Mock axios
jest.mock('axios');
jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { cache } = jest.requireMock('../../utils/redis') as {
  cache: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
};

describe('ErkulGamesService', () => {
  let service: ErkulGamesService;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    cache.del.mockResolvedValue(undefined);
    service = new ErkulGamesService();
  });

  describe('isValidErkulUrl', () => {
    it('should return true for valid Erkul.games URLs', () => {
      expect(service.isValidErkulUrl('https://www.erkul.games/live/calculator')).toBe(true);
      expect(
        service.isValidErkulUrl('https://erkul.games/live/calculator?ship=CUTLASS_BLACK')
      ).toBe(true);
      expect(service.isValidErkulUrl('https://www.erkul.games/loadout/ABC123')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(service.isValidErkulUrl('https://example.com')).toBe(false);
      expect(service.isValidErkulUrl('https://google.com')).toBe(false);
      expect(service.isValidErkulUrl('not-a-url')).toBe(false);
      expect(service.isValidErkulUrl('')).toBe(false);
    });
  });

  describe('extractShipName', () => {
    it('should extract ship name from calculator URL', () => {
      expect(
        service.extractShipName('https://www.erkul.games/live/calculator?ship=CUTLASS_BLACK')
      ).toBe('Cutlass Black');
      expect(
        service.extractShipName('https://www.erkul.games/live/calculator?ship=AURORA_MR')
      ).toBe('Aurora Mr');
      expect(
        service.extractShipName(
          'https://www.erkul.games/live/calculator?ship=CONSTELLATION_ANDROMEDA'
        )
      ).toBe('Constellation Andromeda');
    });

    it('should return null if no ship parameter', () => {
      expect(service.extractShipName('https://www.erkul.games/live/calculator')).toBeNull();
      expect(service.extractShipName('https://www.erkul.games/loadout/ABC123')).toBeNull();
    });
  });

  describe('parseErkulUrl', () => {
    it('should parse a valid Erkul.games calculator URL', async () => {
      const url =
        'https://www.erkul.games/live/calculator?ship=CUTLASS_BLACK&power1=POWER_PLANT_XS&cooler1=COOLER_XS';
      const result = await service.parseErkulUrl(url);

      expect(result.success).toBe(true);
      expect(result.loadout).toBeDefined();
      expect(result.loadout?.shipName).toBe('Cutlass Black');
      expect(result.loadout?.components.length).toBeGreaterThan(0);
      expect(result.loadout?.url).toBe(url);
    });

    it('should return error for invalid URL', async () => {
      const result = await service.parseErkulUrl('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Erkul.games URL');
    });

    it('should return error for URL without ship parameter', async () => {
      const result = await service.parseErkulUrl('https://www.erkul.games/live/calculator');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not determine ship name from URL');
    });

    it('should fetch shared loadout for loadout share URL', async () => {
      // Mock /informations (session token)
      mockedAxios.get.mockResolvedValueOnce({
        data: [{}, { sessionToken: 'test-token' }],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      // Mock /live/loadout/ABC123
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          shipName: 'CUTLASS_BLACK',
          components: [
            { slot: 'power1', name: 'JS-300', type: 'power' },
            { slot: 'shield1', name: 'Sukoran', type: 'shield' },
          ],
        },
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const testService = new ErkulGamesService();
      const result = await testService.parseErkulUrl('https://www.erkul.games/loadout/ABC123');

      expect(result.success).toBe(true);
      expect(result.loadout).toBeDefined();
      expect(result.loadout?.shipName).toBe('Cutlass Black');
      expect(result.loadout?.components).toHaveLength(2);
    });

    it('should return error when shared loadout fetch fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const testService = new ErkulGamesService();
      const result = await testService.parseErkulUrl('https://www.erkul.games/loadout/INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not fetch shared loadout');
    });
  });

  describe('extractLoadoutId', () => {
    it('should extract loadout ID from share URL', () => {
      expect(service.extractLoadoutId('https://www.erkul.games/loadout/ABC123')).toBe('ABC123');
      expect(service.extractLoadoutId('https://www.erkul.games/loadout/RanfKkrz')).toBe('RanfKkrz');
    });

    it('should extract loadout ID from /live/loadout/ share URL', () => {
      expect(service.extractLoadoutId('https://www.erkul.games/live/loadout/ABC123')).toBe(
        'ABC123'
      );
      expect(service.extractLoadoutId('https://www.erkul.games/live/loadout/RanfKkrz')).toBe(
        'RanfKkrz'
      );
    });

    it('should return null for non-loadout URLs', () => {
      expect(
        service.extractLoadoutId('https://www.erkul.games/live/calculator?ship=CUTLASS_BLACK')
      ).toBeNull();
      expect(service.extractLoadoutId('https://www.erkul.games/')).toBeNull();
    });
  });

  describe('generateErkulUrl', () => {
    it('should generate a valid Erkul.games URL for a ship', () => {
      const url = service.generateErkulUrl('Cutlass Black');

      expect(url).toContain('erkul.games/live/calculator');
      expect(url).toContain('ship=CUTLASS_BLACK');
    });

    it('should include components in the URL', () => {
      const components: ErkulComponent[] = [
        { slot: 'power1', name: 'Power Plant XS', type: 'power' },
        { slot: 'cooler1', name: 'Cooler XS', type: 'cooler' },
      ];

      const url = service.generateErkulUrl('Aurora MR', components);

      expect(url).toContain('ship=AURORA_MR');
      expect(url).toContain('power1=POWER_PLANT_XS');
      expect(url).toContain('cooler1=COOLER_XS');
    });
  });

  describe('validateAndParse', () => {
    it('should validate and parse a valid URL', async () => {
      const url = 'https://www.erkul.games/live/calculator?ship=CARRACK';
      const result = await service.validateAndParse(url);

      expect(result.success).toBe(true);
      expect(result.loadout?.shipName).toBe('Carrack');
    });

    it('should return error for invalid domain', async () => {
      const result = await service.validateAndParse('https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a valid Erkul.games URL');
    });
  });

  describe('getComponentTypes', () => {
    it('should return a list of component types', () => {
      const types = service.getComponentTypes();

      expect(types).toContain('power_plant');
      expect(types).toContain('cooler');
      expect(types).toContain('shield_generator');
      expect(types).toContain('quantum_drive');
      expect(types).toContain('weapon');
    });
  });

  describe('fetchShipList', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      cache.get.mockResolvedValue(null);
      cache.set.mockResolvedValue(undefined);
    });

    it('should successfully fetch and parse ship list from Erkul server API', async () => {
      // Mock /informations (session token)
      mockedAxios.get.mockResolvedValueOnce({
        data: [{}, { sessionToken: 'test-token' }],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      // Mock /live/ships (Erkul server format)
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          {
            calculatorType: 'ship',
            localName: 'drak_cutlass_black',
            data: {
              name: 'Cutlass Black',
              subType: 'Vehicle_Spaceship',
              size: 2,
              cargo: 46,
              vehicle: { career: 'Transporter', role: 'Medium Freight', crewSize: 3 },
              manufacturerData: { data: { name: 'Drake Interplanetary' } },
              ifcs: { scmSpeed: 200, maxSpeed: 1200 },
              hull: { mass: 70000 },
            },
          },
          {
            calculatorType: 'ship',
            localName: 'rsi_aurora_mr',
            data: {
              name: 'Aurora MR',
              subType: 'Vehicle_Spaceship',
              size: 1,
              cargo: 3,
              vehicle: { career: 'Multi-Role', role: 'Starter / Light Freight', crewSize: 1 },
              manufacturerData: { data: { name: 'Roberts Space Industries' } },
              ifcs: { scmSpeed: 227, maxSpeed: 1230 },
              hull: { mass: 26245 },
            },
          },
        ],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const testService = new ErkulGamesService();
      const result = await testService.fetchShipList();

      expect(result.success).toBe(true);
      expect(result.ships).toBeDefined();
      expect(result.ships?.length).toBe(2);
      expect(result.ships?.[0].name).toBe('Cutlass Black');
      expect(result.ships?.[0].manufacturer).toBe('Drake Interplanetary');
      expect(result.ships?.[1].name).toBe('Aurora MR');
    });

    it('should handle Erkul server format with loadout hardpoints', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [{}, { sessionToken: 'test-token' }],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: [
          {
            calculatorType: 'ship',
            localName: 'aegs_gladius',
            data: {
              name: 'Gladius',
              subType: 'Vehicle_Spaceship',
              size: 2,
              cargo: 0,
              vehicle: { career: 'Combat', role: 'Light Fighter', crewSize: 1 },
              manufacturerData: { data: { name: 'Aegis Dynamics' } },
              ifcs: { scmSpeed: 226, maxSpeed: 1350 },
              hull: { mass: 30000 },
              loadout: {
                '0': {
                  itemPortName: 'hardpoint_weapon_left',
                  editable: true,
                  itemTypes: [{ type: 'Turret' }],
                  maxSize: 3,
                },
                '1': {
                  itemPortName: 'hardpoint_weapon_right',
                  editable: true,
                  itemTypes: [{ type: 'Turret' }],
                  maxSize: 3,
                },
                '2': {
                  itemPortName: 'hardpoint_weapon_nose',
                  editable: true,
                  itemTypes: [{ type: 'Turret' }],
                  maxSize: 3,
                },
                '3': {
                  itemPortName: 'hardpoint_shield',
                  editable: true,
                  itemTypes: [{ type: 'Shield' }],
                  maxSize: 1,
                },
                '4': {
                  itemPortName: 'hardpoint_paint',
                  editable: true,
                  itemTypes: [{ type: 'Paints' }],
                  maxSize: 1,
                },
              },
            },
          },
        ],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const testService = new ErkulGamesService();
      const result = await testService.fetchShipList();

      expect(result.success).toBe(true);
      const gladius = result.ships?.[0];
      expect(gladius?.name).toBe('Gladius');
      // Should have hardpoints extracted (Paints filtered out)
      expect(gladius?.hardpoints).toBeDefined();
      expect((gladius as Record<string, unknown>).hardpoints).toHaveLength(4); // 3 turrets + 1 shield
      // Should have weapons aggregated
      expect(gladius?.weapons).toBeDefined();
      expect((gladius as Record<string, unknown>).weapons).toHaveLength(1); // 3xS3 Turret grouped
    });

    it('should return error for non-JSON response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [{}, { sessionToken: 'test-token' }],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: '<html><body>Not JSON</body></html>',
        status: 200,
        headers: { 'content-type': 'text/html' },
      });

      const testService = new ErkulGamesService();
      const result = await testService.fetchShipList();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected JSON response');
    });

    it('should return error when no ships found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: [{}, { sessionToken: 'test-token' }],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: [],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const testService = new ErkulGamesService();
      const result = await testService.fetchShipList();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No ships found');
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const testService = new ErkulGamesService();
      const result = await testService.fetchShipList();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch ship list');
      expect(result.error).toContain('Network error');
    });

    it('should handle session token failure gracefully', async () => {
      // /informations returns empty array (no token)
      mockedAxios.get.mockResolvedValueOnce({
        data: [{}],
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const testService = new ErkulGamesService();
      const result = await testService.fetchShipList();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch ship list');
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
