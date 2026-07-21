/**
 * HTML entity decoding utilities.
 *
 * Background: the backend API wraps mutating routes with a global
 * `sanitizeInput` middleware (joiValidators.sanitizeString) which HTML-encodes
 * user-submitted strings before they are persisted. When those strings are
 * later read back and rendered into surfaces that do NOT expect HTML —
 * Discord channel names, embed titles/descriptions, button labels, modal
 * placeholders, etc. — the raw entities (`&#x27;`, `&amp;`, ...) leak to
 * users as literal text instead of their intended characters.
 *
 * Apply {@link decodeHtmlEntities} at the rendering boundary (just before
 * the string crosses into Discord / a non-HTML UI) so storage stays
 * canonically encoded but presentation is clean.
 *
 * Scope: handles the small set of entities that `sanitizeString` actually
 * emits (`&`, `<`, `>`, `"`, `'`). It is intentionally narrow — do NOT
 * extend this into a general-purpose HTML decoder; for that, use a
 * dedicated library.
 */

const ENTITY_MAP: ReadonlyArray<readonly [string, string]> = [
  // Numeric form for apostrophe is what sanitizeString emits.
  ['&#x27;', "'"],
  ['&#39;', "'"],
  ['&quot;', '"'],
  ['&gt;', '>'],
  ['&lt;', '<'],
  // Ampersand last so we don't re-decode entities we just produced.
  ['&amp;', '&'],
];

/**
 * Decode the HTML entities introduced by the backend's `sanitizeInput`
 * middleware. Safe to call on null/undefined-ish values (returns input).
 */
export function decodeHtmlEntities<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }
  let out: string = value;
  for (const [entity, char] of ENTITY_MAP) {
    if (out.includes(entity)) {
      out = out.replaceAll(entity, char);
    }
  }
  return out as T;
}
