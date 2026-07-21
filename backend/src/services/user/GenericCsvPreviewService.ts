import { parse } from 'csv-parse/sync';

import { ValidationError } from '../../utils/apiErrors';

export interface GenericCsvPreview {
  columns: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
}

/**
 * Parses generic CSV input into a lightweight preview payload for generic_csv validation.
 */
export class GenericCsvPreviewService {
  parsePreview(csvData: string): GenericCsvPreview {
    if (typeof csvData !== 'string' || csvData.trim().length < 2) {
      throw new ValidationError('csvData is required for source generic_csv');
    }

    const records = parse<Record<string, string>>(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    if (records.length === 0) {
      throw new Error('CSV is empty');
    }

    const columns = Object.keys(records[0]);
    if (columns.length === 0 || columns.some(column => column.trim().length === 0)) {
      throw new Error('CSV header row is required');
    }

    return {
      columns,
      rowCount: records.length,
      sampleRows: records.slice(0, 5),
    };
  }
}

