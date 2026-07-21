/**
 * UEXPriceFeed — Unit Tests
 *
 * Tests the UEX Corp API 2.0 adapter against the IPriceFeedProvider interface.
 * All HTTP calls are mocked via axios; circuit breaker is mocked via the
 * infrastructure barrel export.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Redis cache facade: default to miss (null) so existing tests fall through to HTTP
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue(true);
const mockCacheDel = jest.fn().mockResolvedValue(true);
const mockCacheDelPattern = jest.fn().mockResolvedValue(0);
const mockCacheGetStatus = jest.fn().mockReturnValue({ connected: true, enabled: true });

jest.mock('../../utils/redis', () => ({
  cache: {
    get: (...args: any[]) => mockCacheGet(...args),
    set: (...args: any[]) => mockCacheSet(...args),
    del: (...args: any[]) => mockCacheDel(...args),
    delPattern: (...args: any[]) => mockCacheDelPattern(...args),
    getStatus: (...args: any[]) => mockCacheGetStatus(...args),
  },
}));

// Circuit breaker: execute just runs the action directly, getState/isHealthy default to healthy
const mockCBExecute = jest.fn((_name: string, action: () => Promise<any>) => action());
const mockCBGetState = jest.fn().mockReturnValue(null);
const mockCBIsHealthy = jest.fn().mockReturnValue(true);

jest.mock('../../services/infrastructure', () => ({
  circuitBreakerService: {
    execute: (...args: any[]) => mockCBExecute(...args),
    getState: (...args: any[]) => mockCBGetState(...args),
    isHealthy: (...args: any[]) => mockCBIsHealthy(...args),
  },
}));

import { UEXPriceFeed } from '../../services/trade/trading/UEXPriceFeed';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a UEX API envelope. */
function uexEnvelope<T>(data: T) {
  return { status: 'ok', data };
}

/** Mock axios.create().get to return the given data for successive calls. */
function mockGet(...responses: { data: any }[]) {
  const get = jest.fn();
  for (const resp of responses) {
    get.mockResolvedValueOnce(resp);
  }
  return get;
}

// ── Setup ────────────────────────────────────────────────────────────────────

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  // Reset env to known state with API key
  process.env.UEX_API_KEY = 'test-key-123';
  process.env.UEX_API_URL = 'https://uex.test/api/2.0';
  delete process.env.UEX_API_TOKEN;
  delete process.env.UEX_API_BEARER_TOKEN;
  delete process.env.UEX_CLIENT_VERSION;
  delete process.env.UEX_API_TIMEOUT;
  delete process.env.UEX_CACHE_TTL;

  // Default circuit breaker behaviour: pass-through
  mockCBExecute.mockImplementation((_name: string, action: () => Promise<any>) => action());
  mockCBGetState.mockReturnValue(null);
  mockCBIsHealthy.mockReturnValue(true);

  // Default Redis behaviour: always miss (so HTTP path is tested)
  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(true);
  mockCacheDel.mockResolvedValue(true);
  mockCacheDelPattern.mockResolvedValue(0);
  mockCacheGetStatus.mockReturnValue({ connected: true, enabled: true });

  mockedAxios.isAxiosError = jest.fn((error: unknown): error is any =>
    Boolean((error as { isAxiosError?: boolean } | null | undefined)?.isAxiosError)
  );
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ── Test data ────────────────────────────────────────────────────────────────

const COMMODITY_LARANITE = { id: 1, name: 'Laranite', code: 'LARA', kind: 'Commodity' };
const COMMODITY_AGRICIUM = { id: 2, name: 'Agricium', code: 'AGRI', kind: 'Commodity' };

const PRICE_LARANITE_BUY = {
  id: 10,
  id_commodity: 1,
  id_terminal: 100,
  price_buy: 27.89,
  price_sell: 0,
  scu_buy: 200,
  scu_sell: 0,
  terminal_name: 'Covalex Hub',
  star_system_name: 'Stanton',
  planet_name: null,
  date_modified: '2026-03-01T10:00:00Z',
};

const PRICE_LARANITE_SELL = {
  id: 11,
  id_commodity: 1,
  id_terminal: 101,
  price_buy: 0,
  price_sell: 31.25,
  scu_buy: 0,
  scu_sell: 500,
  terminal_name: 'Area 18',
  star_system_name: 'Stanton',
  planet_name: 'ArcCorp',
  date_modified: '2026-03-01T12:00:00Z',
};

const TERMINAL_COVALEX = {
  id: 100,
  name: 'Covalex Hub',
  code: 'COV',
  star_system_name: 'Stanton',
};
const TERMINAL_AREA18 = {
  id: 101,
  name: 'Area 18',
  code: 'A18',
  star_system_name: 'Stanton',
  planet_name: 'ArcCorp',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create a UEXPriceFeed instance backed by a mocked axios get function. */
function createFeed(get: jest.Mock) {
  mockedAxios.create.mockReturnValue({ get } as any);
  return new UEXPriceFeed();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UEXPriceFeed', () => {
  // ─── No API key → graceful empty results ──────────────────────────────

  describe('when UEX_API_KEY is not set', () => {
    beforeEach(() => {
      delete process.env.UEX_API_KEY;
    });

    it('searchItems returns []', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.searchItems({ query: 'Laranite' })).toEqual([]);
    });

    it('getItemDetails returns null', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.getItemDetails('Laranite')).toBeNull();
    });

    it('getItemPrices returns []', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.getItemPrices('Laranite')).toEqual([]);
    });

    it('findBestBuyLocation returns null', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.findBestBuyLocation('Laranite')).toBeNull();
    });

    it('findBestSellLocation returns null', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.findBestSellLocation('Laranite')).toBeNull();
    });

    it('comparePrices returns null', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.comparePrices('Laranite')).toBeNull();
    });

    it('getItemsAtLocation returns []', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.getItemsAtLocation('Covalex Hub')).toEqual([]);
    });

    it('getTradingOpportunities returns []', async () => {
      const feed = createFeed(jest.fn());
      expect(await feed.getTradingOpportunities('Covalex Hub', 'Area 18')).toEqual([]);
    });

    it('getStatus reports unhealthy', () => {
      const feed = createFeed(jest.fn());
      const status = feed.getStatus();
      expect(status.healthy).toBe(false);
      expect(status.details?.status).toContain('disabled');
    });
  });

  // ─── searchItems ──────────────────────────────────────────────────────

  describe('searchItems', () => {
    it('fetches commodities and enriches with prices', async () => {
      const get = mockGet(
        // 1st call: /commodities
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        // 2nd call: /commodities_prices for Laranite
        { data: uexEnvelope([PRICE_LARANITE_BUY, PRICE_LARANITE_SELL]) }
      );
      const feed = createFeed(get);

      const results = await feed.searchItems({ query: 'Laranite' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Laranite');
      expect(results[0].locations).toHaveLength(2);
      expect(results[0].averagePrice).toBeDefined();
      expect(results[0].minPrice).toBe(27.89);
      expect(results[0].maxPrice).toBe(31.25);

      // Verify /commodities was called with name param
      expect(get).toHaveBeenCalledWith('/commodities', { params: { name: 'Laranite' } });
    });

    it('returns [] when no commodities match', async () => {
      const get = mockGet({ data: uexEnvelope([]) });
      const feed = createFeed(get);

      expect(await feed.searchItems({ query: 'Unknown' })).toEqual([]);
    });

    it('respects maxResults', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE, COMMODITY_AGRICIUM]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      const results = await feed.searchItems({ query: '', maxResults: 1 });
      expect(results).toHaveLength(1);
    });

    it('returns cached results on second call', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      await feed.searchItems({ query: 'Laranite' });
      const second = await feed.searchItems({ query: 'Laranite' });

      expect(second).toHaveLength(1);
      // Should only have fetched once
      expect(get).toHaveBeenCalledTimes(2); // commodities + prices
    });

    it('returns [] on API error', async () => {
      const get = jest.fn().mockRejectedValue(new Error('Network error'));
      // Circuit breaker must pass through the error
      mockCBExecute.mockRejectedValueOnce(new Error('Network error'));
      const feed = createFeed(get);

      expect(await feed.searchItems({ query: 'Laranite' })).toEqual([]);
    });
  });

  // ─── getItemDetails ───────────────────────────────────────────────────

  describe('getItemDetails', () => {
    it('returns the matching commodity mapped to UIFItem', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, PRICE_LARANITE_SELL]) }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');

      expect(item).not.toBeNull();
      expect(item!.name).toBe('Laranite');
      expect(item!.category).toBe('Commodity');
      expect(item!.locations).toHaveLength(2);
    });

    it('prefers an exact case-insensitive name match', async () => {
      const get = mockGet(
        {
          data: uexEnvelope([{ id: 99, name: 'Laranium', code: 'LARN' }, COMMODITY_LARANITE]),
        },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('laranite');
      expect(item!.name).toBe('Laranite');
    });

    it('returns null when commodity not found', async () => {
      const get = mockGet({ data: uexEnvelope([]) });
      const feed = createFeed(get);

      expect(await feed.getItemDetails('UnknownStuff')).toBeNull();
    });

    it('caches the item for subsequent calls', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      await feed.getItemDetails('Laranite');
      await feed.getItemDetails('Laranite');

      // Only 2 HTTP calls (commodity + prices), not 4
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('returns null on API error', async () => {
      mockCBExecute.mockRejectedValueOnce(new Error('timeout'));
      const feed = createFeed(jest.fn());

      expect(await feed.getItemDetails('Laranite')).toBeNull();
    });
  });

  // ─── getItemPrices ────────────────────────────────────────────────────

  describe('getItemPrices', () => {
    it('returns locations from getItemDetails', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, PRICE_LARANITE_SELL]) }
      );
      const feed = createFeed(get);

      const prices = await feed.getItemPrices('Laranite');
      expect(prices).toHaveLength(2);
      expect(prices[0].type).toBe('buy');
      expect(prices[1].type).toBe('sell');
    });

    it('returns [] when item not found', async () => {
      const get = mockGet({ data: uexEnvelope([]) });
      const feed = createFeed(get);

      expect(await feed.getItemPrices('NonExistent')).toEqual([]);
    });
  });

  // ─── findBestBuyLocation ──────────────────────────────────────────────

  describe('findBestBuyLocation', () => {
    it('returns the lowest-price buy location', async () => {
      const cheapBuy = { ...PRICE_LARANITE_BUY, price_buy: 25, terminal_name: 'CheapHub' };
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, cheapBuy]) }
      );
      const feed = createFeed(get);

      const best = await feed.findBestBuyLocation('Laranite');
      expect(best).not.toBeNull();
      expect(best!.price).toBe(25);
    });

    it('prefers a nearby location when nearLocation is specified', async () => {
      const arcCorpBuy = {
        ...PRICE_LARANITE_BUY,
        price_buy: 50,
        terminal_name: 'ArcCorp Terminal',
        planet_name: 'ArcCorp',
      };
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, arcCorpBuy]) }
      );
      const feed = createFeed(get);

      const best = await feed.findBestBuyLocation('Laranite', 'ArcCorp');
      expect(best).not.toBeNull();
      expect(best!.station).toBe('ArcCorp Terminal');
    });

    it('returns null when no buy locations exist', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_SELL]) } // only sell
      );
      const feed = createFeed(get);

      expect(await feed.findBestBuyLocation('Laranite')).toBeNull();
    });
  });

  // ─── findBestSellLocation ─────────────────────────────────────────────

  describe('findBestSellLocation', () => {
    it('returns the highest-price sell location', async () => {
      const expensiveSell = {
        ...PRICE_LARANITE_SELL,
        price_sell: 40,
        terminal_name: 'ExpStation',
      };
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_SELL, expensiveSell]) }
      );
      const feed = createFeed(get);

      const best = await feed.findBestSellLocation('Laranite');
      expect(best).not.toBeNull();
      expect(best!.price).toBe(40);
    });

    it('returns null when no sell locations exist', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) } // only buy
      );
      const feed = createFeed(get);

      expect(await feed.findBestSellLocation('Laranite')).toBeNull();
    });
  });

  // ─── comparePrices ────────────────────────────────────────────────────

  describe('comparePrices', () => {
    it('returns profit between best buy and best sell', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, PRICE_LARANITE_SELL]) }
      );
      const feed = createFeed(get);

      const cmp = await feed.comparePrices('Laranite');
      expect(cmp).not.toBeNull();
      expect(cmp!.item).toBe('Laranite');
      expect(cmp!.potentialProfit).toBeCloseTo(31.25 - 27.89, 2);
      expect(cmp!.profitMargin).toBeGreaterThan(0);
      expect(cmp!.bestBuyLocation?.type).toBe('buy');
      expect(cmp!.bestSellLocation?.type).toBe('sell');
    });

    it('returns null when no buy or sell exists', async () => {
      const get = mockGet({ data: uexEnvelope([COMMODITY_LARANITE]) }, { data: uexEnvelope([]) });
      const feed = createFeed(get);

      expect(await feed.comparePrices('Laranite')).toBeNull();
    });
  });

  // ─── getItemsAtLocation ───────────────────────────────────────────────

  describe('getItemsAtLocation', () => {
    it('resolves terminal then returns commodities available there', async () => {
      const get = mockGet(
        // /terminals?name=Covalex Hub
        { data: uexEnvelope([TERMINAL_COVALEX]) },
        // /commodities_prices?id_terminal=100
        {
          data: uexEnvelope([
            { ...PRICE_LARANITE_BUY, commodity_name: 'Laranite' },
            {
              id: 20,
              id_commodity: 2,
              id_terminal: 100,
              price_buy: 23.5,
              price_sell: 0,
              scu_buy: 100,
              commodity_name: 'Agricium',
              terminal_name: 'Covalex Hub',
              star_system_name: 'Stanton',
            },
          ]),
        }
      );
      const feed = createFeed(get);

      const items = await feed.getItemsAtLocation('Covalex Hub');
      expect(items).toHaveLength(2);
      expect(items.map(i => i.name).sort((a, b) => a.localeCompare(b))).toEqual([
        'Agricium',
        'Laranite',
      ]);
    });

    it('returns [] when terminal not found', async () => {
      const get = mockGet({ data: uexEnvelope([]) });
      const feed = createFeed(get);

      expect(await feed.getItemsAtLocation('Nonexistent')).toEqual([]);
    });

    it('returns [] on API error', async () => {
      mockCBExecute.mockRejectedValueOnce(new Error('network'));
      const feed = createFeed(jest.fn());

      expect(await feed.getItemsAtLocation('Covalex Hub')).toEqual([]);
    });
  });

  // ─── getTradingOpportunities ──────────────────────────────────────────

  describe('getTradingOpportunities', () => {
    it('finds profitable buy→sell pairs between two terminals', async () => {
      const fromBuy = {
        ...PRICE_LARANITE_BUY,
        id_commodity: 1,
        price_buy: 25,
        price_sell: 0,
        commodity_name: 'Laranite',
      };
      const toSell = {
        ...PRICE_LARANITE_SELL,
        id_commodity: 1,
        price_sell: 35,
        price_buy: 0,
        commodity_name: 'Laranite',
      };
      const get = mockGet(
        // /terminals?name=Covalex Hub
        { data: uexEnvelope([TERMINAL_COVALEX]) },
        // /terminals?name=Area 18
        { data: uexEnvelope([TERMINAL_AREA18]) },
        // /commodities_prices at from terminal
        { data: uexEnvelope([fromBuy]) },
        // /commodities_prices at to terminal
        { data: uexEnvelope([toSell]) }
      );
      const feed = createFeed(get);

      const opps = await feed.getTradingOpportunities('Covalex Hub', 'Area 18');
      expect(opps).toHaveLength(1);
      expect(opps[0].item).toBe('Laranite');
      expect(opps[0].potentialProfit).toBe(10);
      expect(opps[0].profitMargin).toBeCloseTo(40, 0);
    });

    it('filters out items below minMargin', async () => {
      const fromBuy = {
        ...PRICE_LARANITE_BUY,
        id_commodity: 1,
        price_buy: 29,
        commodity_name: 'Laranite',
      };
      const toSell = {
        ...PRICE_LARANITE_SELL,
        id_commodity: 1,
        price_sell: 30,
        commodity_name: 'Laranite',
      };
      const get = mockGet(
        { data: uexEnvelope([TERMINAL_COVALEX]) },
        { data: uexEnvelope([TERMINAL_AREA18]) },
        { data: uexEnvelope([fromBuy]) },
        { data: uexEnvelope([toSell]) }
      );
      const feed = createFeed(get);

      // ~3.4% margin, request 10% minimum
      const opps = await feed.getTradingOpportunities('Covalex Hub', 'Area 18', 10);
      expect(opps).toHaveLength(0);
    });

    it('returns [] when a terminal is not found', async () => {
      const get = mockGet(
        { data: uexEnvelope([TERMINAL_COVALEX]) },
        { data: uexEnvelope([]) } // to terminal not found
      );
      const feed = createFeed(get);

      expect(await feed.getTradingOpportunities('Covalex Hub', 'Nowhere')).toEqual([]);
    });

    it('returns [] on API error', async () => {
      mockCBExecute.mockRejectedValueOnce(new Error('timeout'));
      const feed = createFeed(jest.fn());

      expect(await feed.getTradingOpportunities('A', 'B')).toEqual([]);
    });
  });

  describe('getTopTradeRoutes', () => {
    it('normalizes legacy cached route shape to canonical fields', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-02T12:00:00Z'));
      mockCacheGet.mockResolvedValueOnce([
        {
          commodity_name: 'Laranite',
          commodity_code: 'LARA',
          buy_terminal: 'Covalex Hub',
          buy_location: 'Crusader',
          buy_price: '27.89',
          buy_system: 'Stanton',
          sell_terminal: 'Area 18',
          sell_location: 'ArcCorp',
          sell_price: '31.25',
          sell_system: 'Stanton',
          profit_per_scu: '3.36',
          profit_margin: '12.05',
          scu_available: '200',
          max_profit: '672',
          last_updated: '2026-03-01T10:00:00Z',
        },
      ]);

      const feed = createFeed(jest.fn());

      try {
        const routes = await feed.getTopTradeRoutes();

        expect(routes).toHaveLength(1);
        expect(routes[0]).toMatchObject({
          commodity: 'Laranite',
          commodityCode: 'LARA',
          buyTerminal: 'Covalex Hub',
          buyLocation: 'Crusader',
          buyPrice: 27.89,
          buySystem: 'Stanton',
          sellTerminal: 'Area 18',
          sellLocation: 'ArcCorp',
          sellPrice: 31.25,
          sellSystem: 'Stanton',
          profitPerScu: 3.36,
          profitMargin: 12.05,
          scuAvailable: 200,
          maxProfit: 672,
          lastUpdated: '2026-03-01T10:00:00.000Z',
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('filters out route candidates older than the 3-day freshness window', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00Z'));

      const staleBuy = {
        ...PRICE_LARANITE_BUY,
        id_commodity: 1,
        commodity_name: 'Laranite',
        commodity_code: 'LARA',
        terminal_name: 'Old Buy Terminal',
        price_buy: 20,
        scu_buy: 100,
        date_modified: '2026-03-01T10:00:00Z',
      };
      const staleSell = {
        ...PRICE_LARANITE_SELL,
        id_commodity: 1,
        commodity_name: 'Laranite',
        commodity_code: 'LARA',
        terminal_name: 'Old Sell Terminal',
        price_sell: 35,
        date_modified: '2026-03-01T11:00:00Z',
      };
      const freshBuy = {
        ...PRICE_LARANITE_BUY,
        id_commodity: 2,
        commodity_name: 'Agricium',
        commodity_code: 'AGRI',
        terminal_name: 'Fresh Buy Terminal',
        price_buy: 110,
        scu_buy: 200,
        date_modified: '2026-03-10T08:00:00Z',
      };
      const freshSell = {
        ...PRICE_LARANITE_SELL,
        id_commodity: 2,
        commodity_name: 'Agricium',
        commodity_code: 'AGRI',
        terminal_name: 'Fresh Sell Terminal',
        price_sell: 150,
        date_modified: '2026-03-10T09:00:00Z',
      };

      const get = mockGet({ data: uexEnvelope([staleBuy, staleSell, freshBuy, freshSell]) });
      const feed = createFeed(get);

      try {
        const routes = await feed.getTopTradeRoutes();

        expect(routes).toHaveLength(1);
        expect(routes[0].commodity).toBe('Agricium');
        expect(routes[0].buyTerminal).toBe('Fresh Buy Terminal');
        expect(routes[0].sellTerminal).toBe('Fresh Sell Terminal');
      } finally {
        jest.useRealTimers();
      }
    });

    it('uses commodities_routes endpoint when commodity filter can be resolved', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-10T12:00:00Z'));

      const dateAddedSeconds = Math.floor(new Date('2026-03-10T09:00:00Z').getTime() / 1000);
      const get = mockGet(
        {
          data: uexEnvelope([
            {
              id: 79,
              name: 'Waste',
              code: 'WAST',
              kind: 'Waste',
              is_available: 1,
              is_visible: 1,
              is_buyable: 1,
              is_sellable: 1,
              price_buy: 212,
              price_sell: 344,
            },
          ]),
        },
        {
          data: uexEnvelope([
            {
              id: 18,
              id_commodity: 79,
              id_terminal_origin: 7,
              id_terminal_destination: 274,
              price_origin: 212,
              price_destination: 344,
              price_margin: 132,
              price_roi: 62.26,
              scu_reachable: 75,
              profit: 9900,
              date_added: dateAddedSeconds,
              commodity_name: 'Waste',
              commodity_code: 'WAST',
              origin_star_system_name: 'Stanton',
              origin_planet_name: 'ArcCorp',
              origin_orbit_name: 'ArcCorp',
              origin_terminal_name: 'ArcCorp Mining Area 048',
              destination_star_system_name: 'Stanton',
              destination_planet_name: 'Hurston',
              destination_orbit_name: 'Hurston',
              destination_terminal_name: 'Scrap - Rappel',
            },
          ]),
        }
      );

      const feed = createFeed(get);

      try {
        const routes = await feed.getTopTradeRoutes(25, 5, { commodity: 'Waste' });

        expect(routes).toHaveLength(1);
        expect(routes[0]).toMatchObject({
          commodity: 'Waste',
          buyTerminal: 'ArcCorp Mining Area 048',
          sellTerminal: 'Scrap - Rappel',
          buyPrice: 212,
          sellPrice: 344,
          profitPerScu: 132,
          profitMargin: 62.26,
          scuAvailable: 75,
          maxProfit: 9900,
        });

        expect(get).toHaveBeenCalledWith('/commodities_routes', {
          params: expect.objectContaining({ id_commodity: 79 }),
        });
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ─── Cache lifecycle ──────────────────────────────────────────────────

  describe('clearCache', () => {
    it('forces a re-fetch after cache is cleared', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) },
        // After clear — second fetch
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      await feed.getItemDetails('Laranite');
      expect(get).toHaveBeenCalledTimes(2);

      feed.clearCache();

      await feed.getItemDetails('Laranite');
      expect(get).toHaveBeenCalledTimes(4); // re-fetched after clear
    });
  });

  describe('clearItemCache', () => {
    it('clears only the specified item', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) },
        // Re-fetch after item cache clear
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      await feed.getItemDetails('Laranite');
      feed.clearItemCache('Laranite');
      await feed.getItemDetails('Laranite');

      expect(get).toHaveBeenCalledTimes(4);
    });
  });

  // ─── getStatus ────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('reports operational when key configured and no breaker yet', () => {
      const feed = createFeed(jest.fn());
      const status = feed.getStatus();

      expect(status.name).toBe('UEX');
      expect(status.healthy).toBe(true);
      expect(status.details?.status).toBe('operational');
      expect(status.details?.apiKeyConfigured).toBe(true);
      expect(status.details?.circuitBreaker).toBe('not-initialised');
    });

    it('reports degraded when circuit breaker is open', () => {
      mockCBGetState.mockReturnValue('OPEN');
      mockCBIsHealthy.mockReturnValue(false);

      const feed = createFeed(jest.fn());
      const status = feed.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.details?.status).toContain('degraded');
      expect(status.details?.circuitBreaker).toBe('OPEN');
    });

    it('reports disabled when API key is not set', () => {
      delete process.env.UEX_API_KEY;
      const feed = createFeed(jest.fn());
      const status = feed.getStatus();

      expect(status.healthy).toBe(false);
      expect(status.details?.status).toContain('disabled');
    });

    it('includes memCacheSize and Redis status in details', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      await feed.getItemDetails('Laranite');
      const status = feed.getStatus();
      expect(status.details?.memCacheSize).toBe(1);
      expect(status.details?.redisConnected).toBe(true);
      expect(status.details?.redisEnabled).toBe(true);
      expect(status.details?.cacheTtlSeconds).toBe(900);
    });
  });

  // ─── API envelope unwrapping ──────────────────────────────────────────

  describe('API envelope handling', () => {
    it('unwraps { status, data } envelope', async () => {
      const get = mockGet(
        { data: { status: 'ok', data: [COMMODITY_LARANITE] } },
        { data: { status: 'ok', data: [PRICE_LARANITE_BUY] } }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');
      expect(item).not.toBeNull();
      expect(item!.name).toBe('Laranite');
    });

    it('handles raw array response (no envelope)', async () => {
      const get = mockGet({ data: [COMMODITY_LARANITE] }, { data: [PRICE_LARANITE_BUY] });
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');
      expect(item).not.toBeNull();
    });
  });

  // ─── Response mapping ─────────────────────────────────────────────────

  describe('response mapping', () => {
    it('correctly maps buy and sell locations', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, PRICE_LARANITE_SELL]) }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');
      const buyLoc = item!.locations.find(l => l.type === 'buy');
      const sellLoc = item!.locations.find(l => l.type === 'sell');

      expect(buyLoc).toMatchObject({
        location: 'Covalex Hub',
        system: 'Stanton',
        price: 27.89,
        type: 'buy',
        inStock: true, // scu_buy = 200 > 0
      });

      expect(sellLoc).toMatchObject({
        location: 'Area 18',
        system: 'Stanton',
        planet: 'ArcCorp',
        price: 31.25,
        type: 'sell',
      });
    });

    it('skips zero-price entries', async () => {
      const zeroBuy = { ...PRICE_LARANITE_BUY, price_buy: 0 };
      const zeroSell = { ...PRICE_LARANITE_SELL, price_sell: 0 };
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([zeroBuy, zeroSell]) }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');
      expect(item!.locations).toHaveLength(0);
    });

    it('computes averagePrice as rounded mean of all prices', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY, PRICE_LARANITE_SELL]) }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');
      // (27.89 + 31.25) / 2 = 29.57
      expect(item!.averagePrice).toBeCloseTo(29.57, 2);
    });
  });

  // ─── Constructor configuration ────────────────────────────────────────

  describe('constructor', () => {
    it('uses provided apiBaseUrl over env variable', () => {
      createFeed(jest.fn());
      // The base URL from constructor is used
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://uex.test/api/2.0',
        })
      );
    });

    it('sets api_key header when API key is present', () => {
      createFeed(jest.fn());
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key-123',
            api_key: 'test-key-123',
          }),
        })
      );
    });

    it('normalizes Bearer-prefixed credentials from UEX_API_KEY', () => {
      process.env.UEX_API_KEY = 'Bearer test-key-123';
      createFeed(jest.fn());
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key-123',
            api_key: 'test-key-123',
          }),
        })
      );
    });

    it('uses bearer-token fallback env vars when UEX_API_KEY is absent', () => {
      delete process.env.UEX_API_KEY;
      process.env.UEX_API_BEARER_TOKEN = 'fallback-token';
      createFeed(jest.fn());
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer fallback-token',
            api_key: 'fallback-token',
          }),
        })
      );
    });

    it('omits auth headers when credentials are absent', () => {
      delete process.env.UEX_API_KEY;
      delete process.env.UEX_API_TOKEN;
      delete process.env.UEX_API_BEARER_TOKEN;
      createFeed(jest.fn());
      const callArgs = mockedAxios.create.mock.calls[0][0];
      expect(callArgs?.headers).not.toHaveProperty('api_key');
      expect(callArgs?.headers).not.toHaveProperty('Authorization');
    });

    it('respects UEX_API_TIMEOUT env variable', () => {
      process.env.UEX_API_TIMEOUT = '5000';
      createFeed(jest.fn());
      expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 5000 }));
    });

    it('respects UEX_CACHE_TTL env variable (seconds)', () => {
      process.env.UEX_CACHE_TTL = '600';
      const feed = createFeed(jest.fn());
      const status = feed.getStatus();
      expect(status.details?.cacheTtlSeconds).toBe(600);
    });
  });

  // ─── Redis caching (Sprint 20-B) ─────────────────────────────────────

  describe('auth failure handling', () => {
    it('redacts sensitive values and enters cooldown after 403 responses', async () => {
      const forbiddenError = {
        isAxiosError: true,
        name: 'AxiosError',
        message: 'Request failed with status code 403',
        code: 'ERR_BAD_REQUEST',
        config: {
          method: 'get',
          url: '/terminals',
          params: {
            api_key: 'leaked-query-key',
          },
        },
        response: {
          status: 403,
          statusText: 'Forbidden',
          data: {
            Authorization: 'Bearer leaked-token',
            api_key: 'leaked-api-key',
          },
        },
      };

      const get = jest.fn().mockRejectedValueOnce(forbiddenError);
      const feed = createFeed(get);
      const mockedLogger = jest.requireMock('../../utils/logger').logger as {
        warn: jest.Mock;
      };

      const first = await feed.getTerminalsList();
      const second = await feed.getTerminalsList();

      expect(first).toEqual([]);
      expect(second).toEqual([]);
      expect(get).toHaveBeenCalledTimes(1);

      const authWarnCall = mockedLogger.warn.mock.calls.find(call =>
        String(call[0]).includes('upstream auth failed')
      );

      expect(authWarnCall).toBeDefined();
      const warnPayload = authWarnCall?.[1] as Record<string, unknown>;
      const payloadText = JSON.stringify(warnPayload);
      expect(payloadText).toContain('[REDACTED]');
      expect(payloadText).not.toContain('leaked-token');
      expect(payloadText).not.toContain('leaked-api-key');
      expect(payloadText).not.toContain('leaked-query-key');
    });
  });

  describe('Redis caching', () => {
    it('writes to Redis when setting cache', async () => {
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      await feed.getItemDetails('Laranite');

      expect(mockCacheSet).toHaveBeenCalledWith(
        'uex:item:laranite',
        expect.objectContaining({ name: 'Laranite' }),
        900
      );
    });

    it('returns data from Redis on in-memory miss', async () => {
      const laraniteItem = {
        name: 'Laranite',
        category: 'Commodity',
        locations: [],
        averagePrice: 29,
      };
      mockCacheGet.mockResolvedValueOnce(laraniteItem);

      const get = jest.fn(); // Should NOT be called
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');

      expect(item).toMatchObject({ name: 'Laranite' });
      expect(mockCacheGet).toHaveBeenCalledWith('uex:item:laranite');
      expect(get).not.toHaveBeenCalled();
    });

    it('populates in-memory cache from Redis hit', async () => {
      const laraniteItem = {
        name: 'Laranite',
        category: 'Commodity',
        locations: [],
      };
      mockCacheGet.mockResolvedValueOnce(laraniteItem);
      const get = jest.fn();
      const feed = createFeed(get);

      // First call: Redis hit → populates memory cache
      await feed.getItemDetails('Laranite');
      // Reset Redis to miss
      mockCacheGet.mockResolvedValue(null);
      // Second call: should use in-memory cache (no Redis or HTTP call)
      const second = await feed.getItemDetails('Laranite');
      expect(second).toMatchObject({ name: 'Laranite' });
      expect(get).not.toHaveBeenCalled();
      // Redis was only called once (first call)
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
    });

    it('falls back to HTTP when both caches miss', async () => {
      mockCacheGet.mockResolvedValue(null);
      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      const item = await feed.getItemDetails('Laranite');
      expect(item).not.toBeNull();
      expect(get).toHaveBeenCalledTimes(2);
    });

    it('clearCache deletes Redis keys by pattern', () => {
      const feed = createFeed(jest.fn());
      feed.clearCache();

      expect(mockCacheDelPattern).toHaveBeenCalledWith('uex:*');
    });

    it('clearItemCache deletes the specific Redis prefix', () => {
      const feed = createFeed(jest.fn());
      feed.clearItemCache('Laranite');

      expect(mockCacheDelPattern).toHaveBeenCalledWith('uex:item:laranite*');
    });

    it('gracefully degrades when Redis is unavailable', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockResolvedValue(false); // Redis set fails
      mockCacheGetStatus.mockReturnValue({ connected: false, enabled: false });

      const get = mockGet(
        { data: uexEnvelope([COMMODITY_LARANITE]) },
        { data: uexEnvelope([PRICE_LARANITE_BUY]) }
      );
      const feed = createFeed(get);

      // Should still work via HTTP
      const item = await feed.getItemDetails('Laranite');
      expect(item).not.toBeNull();
      expect(item!.name).toBe('Laranite');
    });
  });

  // ─── IHealthCheckable (Sprint 20-C) ──────────────────────────────────

  describe('IHealthCheckable', () => {
    it('getServiceName returns "UEXPriceFeed"', () => {
      const feed = createFeed(jest.fn());
      expect(feed.getServiceName()).toBe('UEXPriceFeed');
    });

    it('healthCheck reports HEALTHY when API key set and Redis connected', async () => {
      const feed = createFeed(jest.fn());
      const health = await feed.healthCheck();

      expect(health.name).toBe('UEXPriceFeed');
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('operational');
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('healthCheck reports DEGRADED when Redis is disconnected', async () => {
      mockCacheGetStatus.mockReturnValue({ connected: false, enabled: false });
      const feed = createFeed(jest.fn());
      const health = await feed.healthCheck();

      expect(health.status).toBe('degraded');
      expect(health.message).toContain('Redis unavailable');
    });

    it('healthCheck reports UNKNOWN when API key not set', async () => {
      delete process.env.UEX_API_KEY;
      const feed = createFeed(jest.fn());
      const health = await feed.healthCheck();

      expect(health.status).toBe('unknown');
      expect(health.message).toContain('UEX API credential not configured');
    });

    it('healthCheck reports UNHEALTHY when circuit breaker open', async () => {
      mockCBGetState.mockReturnValue('OPEN');
      mockCBIsHealthy.mockReturnValue(false);
      const feed = createFeed(jest.fn());
      const health = await feed.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('circuit breaker open');
    });
  });
});
