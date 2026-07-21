/**
 * GDPR CSV Export Utility
 *
 * Converts nested GDPR export data (Record<string, unknown>) into
 * CSV format. Since GDPR data contains multiple sections (user, consents,
 * ships, activities, etc.), the output is a multi-section CSV with
 * clear section headers.
 *
 * Conforms to GDPR Article 20 (Data Portability) — CSV is a commonly
 * used, machine-readable format.
 */
import { Parser } from 'json2csv';

import { logger } from './logger';

/**
 * Convert GDPR export data to CSV format
 *
 * Each top-level key becomes a labeled section in the output.
 * Objects are flattened into a single-row table.
 * Arrays of objects become multi-row tables.
 * Nested objects within rows are JSON-stringified.
 *
 * @param exportData The GDPR export data from ConsentService.exportUserData()
 * @returns CSV string with all sections concatenated
 */
export function convertGdprDataToCsv(exportData: Record<string, unknown>): string {
  const sections: string[] = [];

  for (const [sectionName, sectionData] of Object.entries(exportData)) {
    try {
      const csvSection = convertSection(sectionName, sectionData);
      if (csvSection) {
        sections.push(csvSection);
      }
    } catch (error) {
      logger.warn(`Failed to convert GDPR section "${sectionName}" to CSV:`, error);
      sections.push(`\n=== ${sectionName.toUpperCase()} ===\n[Error converting section]\n`);
    }
  }

  return sections.join('\n');
}

/**
 * Convert a single section of export data to CSV
 */
function convertSection(name: string, data: unknown): string | null {
  if (data === null || data === undefined) {
    return null;
  }

  const header = `\n=== ${name.toUpperCase()} ===\n`;

  // Array of objects → multi-row CSV table
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${header}[No data]\n`;
    }

    // Check if items are objects (typical case)
    if (typeof data[0] === 'object' && data[0] !== null) {
      const flattenedData = data.map(item => flattenObject(item as Record<string, unknown>));
      const fields = getAllFields(flattenedData);
      const parser = new Parser({ fields, defaultValue: '' });
      return `${header}${parser.parse(flattenedData)}\n`;
    }

    // Array of primitives
    return `${header}${data.join('\n')}\n`;
  }

  // Single object → single-row CSV table
  if (typeof data === 'object') {
    const flattened = flattenObject(data as Record<string, unknown>);
    const fields = Object.keys(flattened);
    if (fields.length === 0) {
      return `${header}[No data]\n`;
    }
    const parser = new Parser({ fields, defaultValue: '' });
    return `${header}${parser.parse(flattened)}\n`;
  }

  // Primitive value
  return `${header}${String(data)}\n`;
}

/**
 * Flatten a nested object into a single-level object.
 * Nested objects/arrays are JSON-stringified.
 * Date objects are converted to ISO strings.
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[fullKey] = null;
    } else if (value instanceof Date) {
      result[fullKey] = value.toISOString();
    } else if (Array.isArray(value)) {
      // Arrays get JSON-stringified to keep CSV flat
      result[fullKey] = JSON.stringify(value);
    } else if (typeof value === 'object') {
      // Nested objects get JSON-stringified
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = value as string | number | boolean;
    }
  }

  return result;
}

/**
 * Get all unique field names across an array of objects
 * to ensure consistent CSV columns
 */
function getAllFields(items: Array<Record<string, string | number | boolean | null>>): string[] {
  const fieldSet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      fieldSet.add(key);
    }
  }
  return Array.from(fieldSet);
}
