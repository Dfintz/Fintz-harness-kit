/**
 * CSV Streaming Export Utility
 *
 * Streams database query results as CSV directly to the HTTP response,
 * avoiding client-side Blob creation that freezes the browser for 1K+ rows.
 *
 * Usage pattern:
 * ```typescript
 * const qb = repo.createQueryBuilder('ship')
 *   .where('ship.organizationId = :orgId', { orgId });
 * await streamCSV(res, qb, columns, 'org-ships.csv');
 * ```
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Finding 6.6
 */

import { Response } from 'express';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { logger } from './logger';

/** Column definition for CSV export */
export interface CSVColumn<T = unknown> {
  /** Column header in the CSV */
  header: string;
  /** Entity field name (used if no `value` function provided) */
  key: string;
  /** Optional custom value extractor. Falls back to `row[key]`. */
  value?: (row: T) => string | number | boolean | null | undefined;
}

/** Escape a value for CSV: quote if it contains commas, quotes, or newlines */
function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

/**
 * Stream a TypeORM query as CSV directly to an Express response.
 *
 * Uses TypeORM's `.stream()` to avoid loading all rows into memory.
 * Each row is immediately written to the response as a CSV line.
 *
 * @param res Express response object
 * @param queryBuilder TypeORM SelectQueryBuilder (will be streamed)
 * @param columns CSV column definitions
 * @param filename Download filename (default: 'export.csv')
 * @param maxRows Safety cap to prevent runaway exports (default: 50000)
 */
export async function streamCSV<T extends ObjectLiteral>(
  res: Response,
  queryBuilder: SelectQueryBuilder<T>,
  columns: CSVColumn<T>[],
  filename: string = 'export.csv',
  maxRows: number = 50_000
): Promise<void> {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');

  // Write BOM for Excel compatibility
  res.write('\uFEFF');

  // Write header row
  res.write(`${columns.map(c => escapeCSV(c.header)).join(',')  }\n`);

  let rowCount = 0;

  const stream = await queryBuilder.stream();

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (rawRow: unknown) => {
      const row = rawRow as Record<string, unknown>;
      if (rowCount >= maxRows) {
        stream.destroy();
        return;
      }

      const line = columns
        .map(col => {
          const val = col.value
            ? col.value(row as T)
            : row[col.key];
          return escapeCSV(val);
        })
        .join(',');

      res.write(`${line  }\n`);
      rowCount++;
    });

    stream.on('end', () => {
      if (rowCount >= maxRows) {
        logger.warn(`CSV export capped at ${maxRows} rows`, { filename });
      }
      resolve();
    });

    stream.on('error', (err: Error) => {
      logger.error('CSV stream error', { filename, error: err.message });
      reject(err);
    });
  });

  res.end();
  logger.info(`CSV export completed: ${filename} (${rowCount} rows)`);
}
