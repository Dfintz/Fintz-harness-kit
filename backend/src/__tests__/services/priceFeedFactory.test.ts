import { createPriceFeedProvider, defaultPriceFeed } from '../../services/trade/trading/priceFeedFactory';
import { UEXPriceFeed } from '../../services/trade/trading/UEXPriceFeed';
import { UIFPriceFeed } from '../../services/trade/trading/UIFPriceFeed';

describe('priceFeedFactory', () => {
  describe('createPriceFeedProvider', () => {
    it('should return a UIFPriceFeed by default', () => {
      const provider = createPriceFeedProvider();
      expect(provider).toBeInstanceOf(UIFPriceFeed);
    });

    it('should return a UIFPriceFeed when "uif" is requested', () => {
      const provider = createPriceFeedProvider('uif');
      expect(provider).toBeInstanceOf(UIFPriceFeed);
    });

    it('should return a UEXPriceFeed when "uex" is requested', () => {
      const provider = createPriceFeedProvider('uex');
      expect(provider).toBeInstanceOf(UEXPriceFeed);
    });

    it('should return distinct instances on each call', () => {
      const a = createPriceFeedProvider('uif');
      const b = createPriceFeedProvider('uif');
      expect(a).not.toBe(b);
    });
  });

  describe('defaultPriceFeed', () => {
    it('should be a UIFPriceFeed instance', () => {
      expect(defaultPriceFeed).toBeInstanceOf(UIFPriceFeed);
    });

    it('should expose the provider name', () => {
      expect(typeof defaultPriceFeed.name).toBe('string');
      expect(defaultPriceFeed.name.length).toBeGreaterThan(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
