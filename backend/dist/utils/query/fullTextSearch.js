"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetFullTextSearchCache = resetFullTextSearchCache;
exports.addFullTextSearch = addFullTextSearch;
exports.addIlikeSearch = addIlikeSearch;
const logger_1 = require("../logger");
let _isPostgres = null;
function isPostgres(qb) {
    if (_isPostgres === null) {
        _isPostgres = qb.connection.options.type === 'postgres';
        if (!_isPostgres) {
            logger_1.logger.debug('Non-PostgreSQL database detected — full-text search will use ILIKE fallback');
        }
    }
    return _isPostgres;
}
function resetFullTextSearchCache() {
    _isPostgres = null;
}
function addFullTextSearch(qb, alias, searchTerm, ilikeColumns, vectorColumn = 'search_vector', paramSuffix = 'fts') {
    const sanitized = searchTerm.replaceAll(/[^a-zA-Z0-9\s-]/g, '').trim();
    if (!sanitized) {
        return false;
    }
    const words = sanitized.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
        return false;
    }
    if (!isPostgres(qb)) {
        addIlikeSearch(qb, alias, sanitized, ilikeColumns, paramSuffix);
        return false;
    }
    const tsquery = words
        .map(w => (w.length >= 2 && w.length <= 3 ? `${w}:*` : w))
        .join(' & ');
    qb.andWhere(`${alias}.${vectorColumn} @@ to_tsquery('english', :tsquery_${paramSuffix})`, { [`tsquery_${paramSuffix}`]: tsquery });
    qb.addOrderBy(`ts_rank(${alias}.${vectorColumn}, to_tsquery('english', :tsquery_${paramSuffix}))`, 'DESC');
    return true;
}
function addIlikeSearch(qb, alias, searchTerm, columns, paramSuffix = 'ilike') {
    if (!searchTerm.trim() || columns.length === 0) {
        return;
    }
    const conditions = columns
        .map(col => `${alias}.${col} ILIKE :search_${paramSuffix}`)
        .join(' OR ');
    qb.andWhere(`(${conditions})`, {
        [`search_${paramSuffix}`]: `%${searchTerm}%`,
    });
}
//# sourceMappingURL=fullTextSearch.js.map