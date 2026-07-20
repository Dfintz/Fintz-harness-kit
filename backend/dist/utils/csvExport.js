"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamCSV = streamCSV;
const logger_1 = require("./logger");
function escapeCSV(val) {
    if (val === null || val === undefined) {
        return '';
    }
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
}
async function streamCSV(res, queryBuilder, columns, filename = 'export.csv', maxRows = 50_000) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.write('\uFEFF');
    res.write(`${columns.map(c => escapeCSV(c.header)).join(',')}\n`);
    let rowCount = 0;
    const stream = await queryBuilder.stream();
    await new Promise((resolve, reject) => {
        stream.on('data', (rawRow) => {
            const row = rawRow;
            if (rowCount >= maxRows) {
                stream.destroy();
                return;
            }
            const line = columns
                .map(col => {
                const val = col.value
                    ? col.value(row)
                    : row[col.key];
                return escapeCSV(val);
            })
                .join(',');
            res.write(`${line}\n`);
            rowCount++;
        });
        stream.on('end', () => {
            if (rowCount >= maxRows) {
                logger_1.logger.warn(`CSV export capped at ${maxRows} rows`, { filename });
            }
            resolve();
        });
        stream.on('error', (err) => {
            logger_1.logger.error('CSV stream error', { filename, error: err.message });
            reject(err);
        });
    });
    res.end();
    logger_1.logger.info(`CSV export completed: ${filename} (${rowCount} rows)`);
}
//# sourceMappingURL=csvExport.js.map