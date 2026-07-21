import { getFrontendUrl } from '../config/urls';

// SCFM token appears either as a bare token or inside a full verification URL.
const RSI_VERIFICATION_TOKEN_PATTERN = /SCFM-[A-Z0-9]{8,24}/gi;
const RSI_VERIFICATION_LINK_PATH = '/verify/rsi';

/**
 * Build a frontend verification URL containing the SCFM token.
 */
export function buildRsiVerificationUrl(token: string): string {
  const normalizedToken = token.trim().toUpperCase();
  const base = getFrontendUrl().replace(/\/+$/, '');
  return `${base}${RSI_VERIFICATION_LINK_PATH}/${normalizedToken}`;
}

/**
 * Extract all SCFM verification tokens from free-form text.
 */
export function extractRsiVerificationTokens(text: string): string[] {
  if (!text) {
    return [];
  }

  const matches = text.match(RSI_VERIFICATION_TOKEN_PATTERN) ?? [];
  const normalized = matches.map(match => match.toUpperCase());
  return [...new Set(normalized)];
}

/**
 * Check whether text contains a specific SCFM token.
 */
export function containsRsiVerificationToken(text: string, expectedToken: string): boolean {
  const normalizedToken = expectedToken.trim().toUpperCase();
  if (!normalizedToken) {
    return false;
  }

  return extractRsiVerificationTokens(text).includes(normalizedToken);
}

/**
 * Check whether any token in text satisfies a matcher callback.
 */
export function someRsiVerificationTokenMatches(
  text: string,
  matcher: (token: string) => boolean
): boolean {
  for (const token of extractRsiVerificationTokens(text)) {
    if (matcher(token)) {
      return true;
    }
  }

  return false;
}
