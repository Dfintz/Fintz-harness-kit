import { countTreeNodes } from '../fleetController.tree';

describe('fleetController.tree', () => {
  describe('countTreeNodes', () => {
    it('returns 0 for an empty tree', () => {
      expect(countTreeNodes([])).toBe(0);
    });

    it('counts a flat list of root nodes', () => {
      const tree = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

      expect(countTreeNodes(tree)).toBe(3);
    });

    it('counts nested children recursively', () => {
      const tree = [
        {
          id: 'root-1',
          children: [{ id: 'child-1' }, { id: 'child-2', children: [{ id: 'grandchild-1' }] }],
        },
        {
          id: 'root-2',
          children: [{ id: 'child-3' }],
        },
      ];

      expect(countTreeNodes(tree)).toBe(6);
    });

    it('treats missing children as empty arrays', () => {
      const tree = [{ id: 'root', children: undefined }, { id: 'root-2' }];

      expect(countTreeNodes(tree)).toBe(2);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
