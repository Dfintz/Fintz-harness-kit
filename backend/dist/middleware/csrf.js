"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtectionFor = exports.csrfProtection = exports.validateCsrfMiddleware = exports.csrfTokenMiddleware = exports.validateCsrfToken = exports.generateCsrfToken = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const cookies_1 = require("../config/cookies");
const logger_1 = require("../utils/logger");
const generateCsrfToken = () => node_crypto_1.default.randomBytes(32).toString('hex');
exports.generateCsrfToken = generateCsrfToken;
const validateCsrfToken = (cookieToken, headerToken) => {
    if (!cookieToken || !headerToken) {
        return false;
    }
    try {
        const cookieBuffer = Buffer.from(cookieToken, 'hex');
        const headerBuffer = Buffer.from(headerToken, 'hex');
        if (cookieBuffer.length !== headerBuffer.length) {
            return false;
        }
        return node_crypto_1.default.timingSafeEqual(cookieBuffer, headerBuffer);
    }
    catch {
        return false;
    }
};
exports.validateCsrfToken = validateCsrfToken;
const csrfTokenMiddleware = (req, res, next) => {
    const existingToken = req.cookies?.[cookies_1.COOKIE_NAMES.CSRF_TOKEN];
    const token = existingToken ?? (0, exports.generateCsrfToken)();
    res.cookie(cookies_1.COOKIE_NAMES.CSRF_TOKEN, token, cookies_1.csrfTokenCookieOptions);
    next();
};
exports.csrfTokenMiddleware = csrfTokenMiddleware;
const validateCsrfMiddleware = (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    const cookieToken = req.cookies?.[cookies_1.COOKIE_NAMES.CSRF_TOKEN];
    if (!cookieToken) {
        logger_1.logger.warn('CSRF validation failed: No cookie token', {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        res.status(403).json({
            success: false,
            error: {
                code: 'CSRF_VALIDATION_FAILED',
                message: 'CSRF cookie not found',
            },
        });
        return;
    }
    const csrfHeader = req.headers['x-csrf-token'];
    const csrfBody = req.body?._csrf;
    const headerToken = (typeof csrfHeader === 'string' ? csrfHeader : undefined) ??
        (typeof csrfBody === 'string' ? csrfBody : undefined);
    if (!headerToken) {
        logger_1.logger.warn('CSRF validation failed: No header token provided', {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        res.status(403).json({
            success: false,
            error: {
                code: 'CSRF_VALIDATION_FAILED',
                message: 'CSRF token required for this request. Include X-CSRF-Token header.',
            },
        });
        return;
    }
    if (!(0, exports.validateCsrfToken)(cookieToken, headerToken)) {
        logger_1.logger.warn('CSRF validation failed: Token mismatch', {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        res.status(403).json({
            success: false,
            error: {
                code: 'CSRF_VALIDATION_FAILED',
                message: 'Invalid CSRF token',
            },
        });
        return;
    }
    next();
};
exports.validateCsrfMiddleware = validateCsrfMiddleware;
exports.csrfProtection = {
    generate: exports.csrfTokenMiddleware,
    validate: exports.validateCsrfMiddleware,
    protect: (req, res, next) => {
        (0, exports.csrfTokenMiddleware)(req, res, () => {
            (0, exports.validateCsrfMiddleware)(req, res, next);
        });
    },
};
const csrfProtectionFor = (methods = ['POST', 'PUT', 'PATCH', 'DELETE']) => (req, res, next) => {
    (0, exports.csrfTokenMiddleware)(req, res, () => {
        if (methods.includes(req.method.toUpperCase())) {
            (0, exports.validateCsrfMiddleware)(req, res, next);
        }
        else {
            next();
        }
    });
};
exports.csrfProtectionFor = csrfProtectionFor;
//# sourceMappingURL=csrf.js.map