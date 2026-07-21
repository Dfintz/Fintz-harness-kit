/**
 * Generates a URL-friendly slug from a string.
 *
 * NOTE: This file is partially duplicated at frontend/src/utils/slugify.ts.
 * Both copies must be kept in sync until a shared-utils package is created.
 *
 * Examples:
 *   slugify("Test Organization Alpha")  → "test-organization-alpha"
 *   slugify("Fleet Ops — 24/7")         → "fleet-ops-24-7"
 *   slugify("  Hello   World  ")        → "hello-world"
 *
 * @param text The input string to slugify
 * @returns A lowercase, hyphen-separated, URL-safe string
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric chars except spaces/hyphens
    .replace(/[\s-]+/g, '-') // Collapse whitespace/hyphens into single hyphen
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}

/**
 * Check if a string looks like a UUID (v4 format).
 */
export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
