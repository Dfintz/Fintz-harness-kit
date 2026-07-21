import { parseBooleanQuery } from '../../utils/queryUtils';

describe('queryUtils', () => {
  describe('parseBooleanQuery', () => {
    // ==================== String inputs ====================

    it('should return true for string "true"', () => {
      expect(parseBooleanQuery('true')).toBe(true);
    });

    it('should return false for string "false"', () => {
      expect(parseBooleanQuery('false')).toBe(false);
    });

    it('should return false for arbitrary string', () => {
      expect(parseBooleanQuery('yes')).toBe(false);
      expect(parseBooleanQuery('1')).toBe(false);
      expect(parseBooleanQuery('')).toBe(false);
    });

    // ==================== Boolean inputs (Joi-coerced) ====================

    it('should return true for boolean true', () => {
      expect(parseBooleanQuery(true)).toBe(true);
    });

    it('should return false for boolean false', () => {
      expect(parseBooleanQuery(false)).toBe(false);
    });

    // ==================== Absent / null inputs ====================

    it('should return default (false) for undefined', () => {
      expect(parseBooleanQuery(undefined)).toBe(false);
    });

    it('should return default (false) for null', () => {
      expect(parseBooleanQuery(null)).toBe(false);
    });

    // ==================== Non-standard types ====================

    it('should return default for number input', () => {
      expect(parseBooleanQuery(1)).toBe(false);
      expect(parseBooleanQuery(0)).toBe(false);
    });

    it('should return default for object input', () => {
      expect(parseBooleanQuery({})).toBe(false);
      expect(parseBooleanQuery([])).toBe(false);
    });

    // ==================== Custom default value ====================

    it('should use custom default when value is undefined', () => {
      expect(parseBooleanQuery(undefined, true)).toBe(true);
    });

    it('should use custom default when value is null', () => {
      expect(parseBooleanQuery(null, true)).toBe(true);
    });

    it('should ignore custom default when value is present', () => {
      expect(parseBooleanQuery('false', true)).toBe(false);
      expect(parseBooleanQuery(false, true)).toBe(false);
      expect(parseBooleanQuery('true', false)).toBe(true);
      expect(parseBooleanQuery(true, false)).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
