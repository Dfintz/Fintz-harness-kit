"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardResponseMiddleware = void 0;
const standardResponseMiddleware = (req, res, next) => {
    res.success = function (data, meta) {
        const response = {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.id,
                ...meta
            }
        };
        return this.json(response);
    };
    res.paginated = function (data, pagination, links) {
        const limit = pagination.limit;
        const offset = pagination.offset;
        const total = pagination.total;
        const page = pagination.page ?? Math.floor(offset / limit) + 1;
        const totalPages = pagination.totalPages ?? Math.ceil(total / limit);
        const response = {
            success: true,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.id,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: pagination.hasMore ?? (offset + limit < total),
                    page,
                    totalPages,
                    hasNext: pagination.hasNext ?? (page < totalPages),
                    hasPrevious: pagination.hasPrevious ?? (page > 1)
                }
            }
        };
        if (links) {
            response.links = links;
        }
        return this.json(response);
    };
    res.error = function (code, message, details, statusCode = 500) {
        const response = {
            success: false,
            error: {
                code,
                message,
                details,
                timestamp: new Date().toISOString(),
                requestId: req.id
            }
        };
        return this.status(statusCode).json(response);
    };
    next();
};
exports.standardResponseMiddleware = standardResponseMiddleware;
//# sourceMappingURL=standardResponse.js.map