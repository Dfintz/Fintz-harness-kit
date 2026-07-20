/**
 * Generates a URL-friendly slug from a string.
 *
 * NOTE: This file is partially duplicated at backend/src/utils/slugify.ts.
 * Both copies must be kept in sync until a shared-utils package is created.
 *
 * Examples:
 *   slugify("Test Organization Alpha")  → "test-organization-alpha"
 *   slugify("Fleet Commander — Hiring") → "fleet-commander-hiring"
 *
 * @param text The input string to slugify
 * @returns A lowercase, hyphen-separated, URL-safe string
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
