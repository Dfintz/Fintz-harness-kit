"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericCsvPreviewService = void 0;
const sync_1 = require("csv-parse/sync");
const apiErrors_1 = require("../../utils/apiErrors");
class GenericCsvPreviewService {
    parsePreview(csvData) {
        if (typeof csvData !== 'string' || csvData.trim().length < 2) {
            throw new apiErrors_1.ValidationError('csvData is required for source generic_csv');
        }
        const records = (0, sync_1.parse)(csvData, {
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
exports.GenericCsvPreviewService = GenericCsvPreviewService;
//# sourceMappingURL=GenericCsvPreviewService.js.map