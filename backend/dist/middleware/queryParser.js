"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryParserMiddleware = void 0;
exports.parseQueryParams = parseQueryParams;
exports.buildHateoasLinks = buildHateoasLinks;
exports.selectFields = selectFields;
exports.selectFieldsFromArray = selectFieldsFromArray;
exports.validateSortField = validateSortField;
exports.validateFilters = validateFilters;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
function parseQueryParams(query) {
    let limit = Number.parseInt(query.limit) || DEFAULT_LIMIT;
    limit = Math.min(Math.max(1, limit), MAX_LIMIT);
    let offset = Number.parseInt(query.offset);
    if (Number.isNaN(offset)) {
        const page = Number.parseInt(query.page) || 1;
        offset = (page - 1) * limit;
    }
    offset = Math.max(0, offset);
    let sort = null;
    if (query.sort && typeof query.sort === 'string') {
        const sortParam = query.sort.trim();
        if (sortParam.startsWith('-')) {
            sort = { field: sortParam.substring(1), order: 'DESC' };
        }
        else if (sortParam.startsWith('+')) {
            sort = { field: sortParam.substring(1), order: 'ASC' };
        }
        else {
            sort = { field: sortParam, order: 'ASC' };
        }
    }
    const filters = {};
    const filterRegex = /^filter\[([^\]]+)\]$/;
    const assignFilter = (field, value) => {
        if (Array.isArray(value)) {
            filters[field] = value.filter(v => typeof v === 'string' || typeof v === 'number').map(String);
        }
        else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            filters[field] = String(value);
        }
    };
    Object.keys(query).forEach(key => {
        const filterMatch = filterRegex.exec(key);
        if (filterMatch) {
            assignFilter(filterMatch[1], query[key]);
        }
    });
    const nestedFilter = query.filter;
    if (nestedFilter && typeof nestedFilter === 'object' && !Array.isArray(nestedFilter)) {
        Object.entries(nestedFilter).forEach(([field, value]) => {
            assignFilter(field, value);
        });
    }
    let fields = null;
    if (query.fields && typeof query.fields === 'string') {
        fields = query.fields
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean);
    }
    const search = typeof query.search === 'string' ? query.search.trim() || null : null;
    return {
        limit,
        offset,
        sort,
        filters,
        fields,
        search,
    };
}
function buildHateoasLinks(basePath, offset, limit, total, queryParams) {
    const buildUrl = (newOffset) => {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        params.set('offset', String(newOffset));
        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (key !== 'limit' && key !== 'offset') {
                    params.set(key, value);
                }
            });
        }
        return `${basePath}?${params.toString()}`;
    };
    const lastOffset = Math.max(0, Math.floor((total - 1) / limit) * limit);
    const links = {
        self: buildUrl(offset),
        first: buildUrl(0),
        last: buildUrl(lastOffset),
    };
    if (offset > 0) {
        links.prev = buildUrl(Math.max(0, offset - limit));
    }
    if (offset + limit < total) {
        links.next = buildUrl(offset + limit);
    }
    return links;
}
function selectFields(obj, fields) {
    if (!fields || fields.length === 0) {
        return obj;
    }
    const result = {};
    fields.forEach(field => {
        if (field in obj) {
            result[field] = obj[field];
        }
    });
    return result;
}
function selectFieldsFromArray(items, fields) {
    if (!fields || fields.length === 0) {
        return items;
    }
    return items.map(item => selectFields(item, fields));
}
const queryParserMiddleware = (req, _res, next) => {
    req.queryParams = parseQueryParams(req.query);
    next();
};
exports.queryParserMiddleware = queryParserMiddleware;
function fieldMatchesAllowed(field, allowedFields) {
    const fieldLower = field.toLowerCase();
    const snakeCase = field.replaceAll(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    return (allowedFields.includes(field) ||
        allowedFields.includes(fieldLower) ||
        allowedFields.includes(snakeCase));
}
function validateSortField(sort, allowedFields) {
    if (!sort) {
        return null;
    }
    if (fieldMatchesAllowed(sort.field, allowedFields)) {
        return sort;
    }
    return null;
}
function validateFilters(filters, allowedFields) {
    const validFilters = {};
    Object.entries(filters).forEach(([field, value]) => {
        if (fieldMatchesAllowed(field, allowedFields)) {
            validFilters[field] = value;
        }
    });
    return validFilters;
}
//# sourceMappingURL=queryParser.js.map