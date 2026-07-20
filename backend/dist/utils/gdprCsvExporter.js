"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertGdprDataToCsv = convertGdprDataToCsv;
const json2csv_1 = require("json2csv");
const logger_1 = require("./logger");
function convertGdprDataToCsv(exportData) {
    const sections = [];
    for (const [sectionName, sectionData] of Object.entries(exportData)) {
        try {
            const csvSection = convertSection(sectionName, sectionData);
            if (csvSection) {
                sections.push(csvSection);
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to convert GDPR section "${sectionName}" to CSV:`, error);
            sections.push(`\n=== ${sectionName.toUpperCase()} ===\n[Error converting section]\n`);
        }
    }
    return sections.join('\n');
}
function convertSection(name, data) {
    if (data === null || data === undefined) {
        return null;
    }
    const header = `\n=== ${name.toUpperCase()} ===\n`;
    if (Array.isArray(data)) {
        if (data.length === 0) {
            return `${header}[No data]\n`;
        }
        if (typeof data[0] === 'object' && data[0] !== null) {
            const flattenedData = data.map(item => flattenObject(item));
            const fields = getAllFields(flattenedData);
            const parser = new json2csv_1.Parser({ fields, defaultValue: '' });
            return `${header}${parser.parse(flattenedData)}\n`;
        }
        return `${header}${data.join('\n')}\n`;
    }
    if (typeof data === 'object') {
        const flattened = flattenObject(data);
        const fields = Object.keys(flattened);
        if (fields.length === 0) {
            return `${header}[No data]\n`;
        }
        const parser = new json2csv_1.Parser({ fields, defaultValue: '' });
        return `${header}${parser.parse(flattened)}\n`;
    }
    return `${header}${String(data)}\n`;
}
function flattenObject(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value === null || value === undefined) {
            result[fullKey] = null;
        }
        else if (value instanceof Date) {
            result[fullKey] = value.toISOString();
        }
        else if (Array.isArray(value)) {
            result[fullKey] = JSON.stringify(value);
        }
        else if (typeof value === 'object') {
            result[fullKey] = JSON.stringify(value);
        }
        else {
            result[fullKey] = value;
        }
    }
    return result;
}
function getAllFields(items) {
    const fieldSet = new Set();
    for (const item of items) {
        for (const key of Object.keys(item)) {
            fieldSet.add(key);
        }
    }
    return Array.from(fieldSet);
}
//# sourceMappingURL=gdprCsvExporter.js.map