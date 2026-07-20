"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logValidatedRequest = exports.openapiErrorHandler = exports.openapiValidatorMiddleware = void 0;
const path_1 = __importDefault(require("path"));
const OpenApiValidator = __importStar(require("express-openapi-validator"));
const logger_1 = require("../utils/logger");
exports.openapiValidatorMiddleware = OpenApiValidator.middleware({
    apiSpec: path_1.default.join(__dirname, '../../openapi/api.yaml'),
    validateRequests: true,
    validateResponses: false,
    validateSecurity: {
        handlers: {
            bearerAuth: async (req, _scopes) => {
                const authHeader = req.headers.authorization;
                if (!authHeader?.startsWith('Bearer ')) {
                    return false;
                }
                return true;
            },
        },
    },
    ignorePaths: /^\/(?!api).*/,
    validateFormats: 'fast',
    $refParser: {
        mode: 'dereference',
    },
});
const openapiErrorHandler = (err, req, res, next) => {
    if (err?.status) {
        logger_1.logger.warn('OpenAPI validation error', {
            path: req.path,
            method: req.method,
            error: err.message,
            errors: err.errors,
        });
        const errors = (err.errors)?.map((e) => ({
            field: e.path,
            message: e.message,
            code: e.errorCode,
        })) || [];
        res.status(err.status).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            message: err.message || 'Request validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
        });
        return;
    }
    next(err);
};
exports.openapiErrorHandler = openapiErrorHandler;
const logValidatedRequest = (req, res, next) => {
    logger_1.logger.debug('Request validated against OpenAPI spec', {
        path: req.path,
        method: req.method,
        operationId: req.openapi?.schema?.operationId,
    });
    next();
};
exports.logValidatedRequest = logValidatedRequest;
//# sourceMappingURL=openapiValidation.js.map