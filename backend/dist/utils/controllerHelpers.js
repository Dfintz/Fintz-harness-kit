"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaginationParams = parsePaginationParams;
exports.parseDateRangeFilter = parseDateRangeFilter;
exports.parseStatusFilter = parseStatusFilter;
exports.parseSearchTerm = parseSearchTerm;
function parsePaginationParams(query) {
    const { page, limit, sortBy, sortOrder } = query;
    return {
        page: page ? Number.parseInt(page, 10) : 1,
        limit: limit ? Number.parseInt(limit, 10) : 20,
        sortBy: sortBy,
        sortOrder: sortOrder,
    };
}
function parseDateRangeFilter(query) {
    const { startDate, endDate } = query;
    const filter = {};
    if (startDate) {
        filter.startDate = new Date(startDate);
    }
    if (endDate) {
        filter.endDate = new Date(endDate);
    }
    return filter;
}
function parseStatusFilter(query, validStatuses) {
    const { status, statuses } = query;
    const filter = {};
    if (statuses) {
        const statusArray = typeof statuses === 'string'
            ? statuses.split(',').map(s => s.trim())
            : statuses;
        const validatedStatuses = statusArray.filter(s => validStatuses.includes(s));
        if (validatedStatuses.length > 0) {
            filter.statuses = validatedStatuses;
        }
    }
    else if (status && validStatuses.includes(status)) {
        filter.status = status;
    }
    return filter;
}
function parseSearchTerm(query) {
    const { search } = query;
    return search ? search : undefined;
}
//# sourceMappingURL=controllerHelpers.js.map