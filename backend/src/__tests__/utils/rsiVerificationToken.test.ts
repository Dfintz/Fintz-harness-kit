import {
  buildRsiVerificationUrl,
  containsRsiVerificationToken,
  extractRsiVerificationTokens,
  someRsiVerificationTokenMatches,
} from '../../utils/rsiVerificationToken';

describe('rsiVerificationToken utils', () => {
  describe('buildRsiVerificationUrl', () => {
    it('should build a verification URL ending with /verify/rsi/<TOKEN>', () => {
      const token = 'scfm-abc123ff';
      const url = buildRsiVerificationUrl(token);

      expect(url.endsWith('/verify/rsi/SCFM-ABC123FF')).toBe(true);
    });
  });

  describe('extractRsiVerificationTokens', () => {
    it('should extract and normalize tokens from mixed plain text and URL text', () => {
      const text =
        'Plain token SCFM-ABC123FF and URL https://example.com/verify/rsi/scfm-abc123ff ' +
        'plus second token SCFM-XYZ99988';

      const tokens = extractRsiVerificationTokens(text);

      expect(tokens).toEqual(['SCFM-ABC123FF', 'SCFM-XYZ99988']);
    });

    it('should return an empty array for empty input', () => {
      expect(extractRsiVerificationTokens('')).toEqual([]);
    });
  });

  describe('containsRsiVerificationToken', () => {
    it('should return true when expected token appears in a full URL', () => {
      const expected = 'SCFM-ABC123FF';
      const text = `Please verify at https://scfleetmanager.com/verify/rsi/${expected}`;

      expect(containsRsiVerificationToken(text, expected)).toBe(true);
    });

    it('should return false for empty expected token', () => {
      expect(containsRsiVerificationToken('SCFM-ABC123FF', '   ')).toBe(false);
    });
  });

  describe('someRsiVerificationTokenMatches', () => {
    it('should call matcher for normalized tokens and return true for first match', () => {
      const matcher = jest.fn((token: string) => token.endsWith('XYZ99988'));

      const found = someRsiVerificationTokenMatches(
        'token1 scfm-abc123ff token2 scfm-xyz99988',
        matcher
      );

      expect(found).toBe(true);
      expect(matcher).toHaveBeenCalledWith('SCFM-ABC123FF');
      expect(matcher).toHaveBeenCalledWith('SCFM-XYZ99988');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
