import { toStatRecord } from '../fleetController.stats';

describe('fleetController.stats', () => {
  describe('toStatRecord', () => {
    it('normalizes keyed stat rows into count records', () => {
      const rows = [
        { role: 'fighter', count: '2' },
        { role: 'transport', count: '5' },
      ];

      expect(toStatRecord(rows, 'role')).toEqual({ fighter: 2, transport: 5 });
    });

    it('falls back to unknown when keyed value is missing', () => {
      const rows = [{ count: '3' }];

      expect(toStatRecord(rows, 'manufacturer')).toEqual({ unknown: 3 });
    });

    it('keeps parseInt semantics for numeric string counts', () => {
      const rows = [
        { career: 'combat', count: '10.9' },
        { career: 'trade', count: '0' },
      ];

      expect(toStatRecord(rows, 'career')).toEqual({ combat: 10, trade: 0 });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
