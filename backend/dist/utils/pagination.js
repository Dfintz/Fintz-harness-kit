"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPaginationOptions = extractPaginationOptions;
exports.parsePaginationQuery = parsePaginationQuery;
exports.safeParseLimit = safeParseLimit;
exports.paginateRepository = paginateRepository;
exports.paginateQueryBuilder = paginateQueryBuilder;
exports.paginateArray = paginateArray;
function extractPaginationOptions(req) {
    return parsePaginationQuery(req.query);
}
function parseNumericParam(value) {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        return Number.parseInt(value, 10);
    }
    return Number.NaN;
}
function parsePaginationQuery(query, defaults) {
    const MAX_LIMIT = 100;
    const defaultPage = defaults?.page ?? 1;
    const defaultLimit = defaults?.limit ?? 20;
    const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
    const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
    const parsedPage = parseNumericParam(rawPage);
    const parsedLimit = parseNumericParam(rawLimit);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
    let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
    if (limit > MAX_LIMIT) {
        limit = MAX_LIMIT;
    }
    const rawSortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined;
    const rawSortOrder = typeof query.sortOrder === 'string' ? query.sortOrder : '';
    const sortOrder = rawSortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return { page, limit, sortBy: rawSortBy, sortOrder };
}
function safeParseLimit(raw, defaultLimit = 20, maxLimit = 200) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
        return defaultLimit;
    }
    return Math.min(parsed, maxLimit);
}
async function paginateRepository(repository, options, whereConditions, defaultSortField = 'createdAt') {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || defaultSortField;
    const sortOrder = options.sortOrder || 'DESC';
    const findOptions = {
        skip,
        take: limit,
        order: { [sortBy]: sortOrder },
    };
    if (whereConditions) {
        findOptions.where = whereConditions;
    }
    const [data, total] = await repository.findAndCount(findOptions);
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
async function paginateQueryBuilder(queryBuilder, options) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);
    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
function paginateArray(items, options, sortFunction) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    const sortedItems = [...items];
    if (sortFunction) {
        sortedItems.sort(sortFunction);
    }
    const data = sortedItems.slice(skip, skip + limit);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    };
}
//# sourceMappingURL=pagination.js.map