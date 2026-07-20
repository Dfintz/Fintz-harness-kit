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
exports.validateEnvironment = exports.sanitizeInput = exports.rsiApiRateLimiter = exports.webhookRateLimiter = exports.uploadRateLimiter = exports.authRateLimiter = exports.rateLimiter = exports.corsConfig = exports.removePoweredBy = exports.swaggerCspMiddleware = exports.helmetConfig = void 0;
exports.resolveSwaggerEnabled = resolveSwaggerEnabled;
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const ipWhitelist_1 = require("../utils/ipWhitelist");
const joiValidators_1 = require("../utils/joiValidators");
const logger_1 = require("../utils/logger");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const errorHandler_1 = require("./errorHandler");
const getRateLimitKey = (req) => {
    const ip = req.ip || 'unknown';
    const baseIp = (0, express_rate_limit_1.ipKeyGenerator)(ip);
    const normalizedIp = (0, ipWhitelist_1.normalizeIP)(baseIp);
    return normalizedIp || 'unknown';
};
const isDevelopment = process.env.NODE_ENV !== 'production';
exports.helmetConfig = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            frameSrc: [
                "'self'",
                'https://verseguide.com',
                'https://snareplan.dolus.eu',
                'https://maps.adi.sc',
            ],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
        },
        useDefaults: false,
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    hidePoweredBy: true,
    referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
    },
});
const swaggerCspMiddleware = (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "img-src 'self' data: blob: https:; " +
        "font-src 'self' data:;");
    next();
};
exports.swaggerCspMiddleware = swaggerCspMiddleware;
const removePoweredBy = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
};
exports.removePoweredBy = removePoweredBy;
function resolveSwaggerEnabled() {
    const isProduction = process.env.NODE_ENV === 'production';
    const requested = process.env.SWAGGER_ENABLED !== 'false';
    const forceProd = process.env.SWAGGER_FORCE_PROD === 'true';
    if (isProduction) {
        if (requested && !forceProd) {
            const msg = 'FATAL: SWAGGER_ENABLED is not "false" in production. Swagger UI is disabled by default ' +
                'in production. To intentionally expose docs, set SWAGGER_FORCE_PROD=true; otherwise set ' +
                'SWAGGER_ENABLED=false to acknowledge the production posture.';
            logger_1.logger.error(msg);
            throw new Error(msg);
        }
        return forceProd && requested;
    }
    return requested;
}
const rawCorsOrigin = process.env.CORS_ORIGIN?.trim() || '';
const corsOrigin = rawCorsOrigin || '*';
let isWildcardOrigin = corsOrigin === '*';
if (isWildcardOrigin) {
    logger_1.logger.warn('⚠️  CORS_ORIGIN not configured - using wildcard (*). Credentials mode DISABLED.');
    logger_1.logger.warn('⚠️  Authentication cookies will NOT work. Set CORS_ORIGIN to your frontend domain.');
}
else {
    logger_1.logger.info(`✓ CORS configured for origin(s): ${corsOrigin}`);
    logger_1.logger.info('✓ Credentials mode ENABLED for cookie-based authentication');
}
function parseCorsOrigin(origin, isWildcard) {
    if (isWildcard) {
        return '*';
    }
    const stripQuotes = (s) => {
        let start = 0;
        let end = s.length;
        while (start < end && (s[start] === '"' || s[start] === "'")) {
            start++;
        }
        while (end > start && (s[end - 1] === '"' || s[end - 1] === "'")) {
            end--;
        }
        return s.slice(start, end);
    };
    if (origin.includes(',')) {
        return origin
            .split(',')
            .map(o => stripQuotes(o.trim()))
            .filter(o => o.length > 0);
    }
    return [stripQuotes(origin)];
}
let allowedOrigins = parseCorsOrigin(corsOrigin, isWildcardOrigin);
if (Array.isArray(allowedOrigins) && allowedOrigins.length === 0) {
    logger_1.logger.error('\u274c CORS_ORIGIN configured but resulted in empty origin list.');
    logger_1.logger.error('\u274c Check your CORS_ORIGIN environment variable for invalid values.');
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: CORS_ORIGIN configured but resulted in empty origin list. ' +
            'This is a security misconfiguration. Set CORS_ORIGIN to valid origin(s).');
    }
    allowedOrigins = '*';
    isWildcardOrigin = true;
}
const corsOriginCallback = (requestOrigin, callback) => {
    if (allowedOrigins === '*') {
        callback(null, true);
        return;
    }
    if (!requestOrigin) {
        callback(null, true);
        return;
    }
    if (Array.isArray(allowedOrigins) && allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
    }
    logger_1.logger.warn('CORS rejection', {
        requestOrigin,
        allowedOrigins,
    });
    callback(new errorHandler_1.AppError('Not allowed by CORS', 403));
};
exports.corsConfig = (0, cors_1.default)({
    origin: isWildcardOrigin ? '*' : corsOriginCallback,
    credentials: !isWildcardOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Device-Fingerprint'],
    exposedHeaders: [
        'Content-Length',
        'X-Request-Id',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
    ],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
});
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
    skip: (req) => {
        if (isDevelopment) {
            return true;
        }
        if (req.path.startsWith('/health')) {
            return true;
        }
        return false;
    },
});
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
});
exports.uploadRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 5,
    message: 'Too many uploads, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
});
exports.webhookRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many webhook creation attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
});
exports.rsiApiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many RSI API requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRateLimitKey,
});
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            const cleaned = (0, prototypePollutionPrevention_1.sanitizeObject)(obj);
            const sanitized = {};
            for (const key in cleaned) {
                const sanitizedKey = typeof key === 'string' ? (0, joiValidators_1.sanitizeString)(key) : key;
                sanitized[sanitizedKey] = sanitize(cleaned[key]);
            }
            return sanitized;
        }
        if (typeof obj === 'string') {
            let sanitized = (0, joiValidators_1.sanitizeString)(obj);
            sanitized = (0, joiValidators_1.removeSQLPatterns)(sanitized);
            return sanitized;
        }
        return obj;
    };
    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }
    if (req.params) {
        req.params = sanitize(req.params);
    }
    next();
};
exports.sanitizeInput = sanitizeInput;
function validateJwtSecret(isProduction, errors) {
    const requiredEnvVars = ['JWT_SECRET'];
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingEnvVars.length > 0) {
        const errorMsg = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
        logger_1.logger.warn(`⚠️  Warning: ${errorMsg}`);
        if (isProduction) {
            errors.push(errorMsg);
        }
        else {
            logger_1.logger.warn('Using default values - this is NOT secure for production!');
        }
    }
    if (isProduction &&
        (!process.env.JWT_SECRET ||
            process.env.JWT_SECRET.includes('change-in-production') ||
            process.env.JWT_SECRET.includes('change-this') ||
            process.env.JWT_SECRET.includes('dev-secret') ||
            process.env.JWT_SECRET.length < 32)) {
        const errorMsg = 'JWT_SECRET must be set to a secure value (minimum 32 characters) in production!';
        logger_1.logger.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
    }
}
function validateSecuritySettings(isProduction, errors) {
    if (isProduction && process.env.ALLOW_DEV_LOGIN === 'true') {
        const errorMsg = 'ALLOW_DEV_LOGIN must not be enabled in production! This creates a critical security vulnerability.';
        logger_1.logger.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
    }
    if (isProduction) {
        if (process.env.TOKEN_ENCRYPTION_KEY &&
            (process.env.TOKEN_ENCRYPTION_KEY.length < 32 ||
                process.env.TOKEN_ENCRYPTION_KEY.includes('dev-') ||
                process.env.TOKEN_ENCRYPTION_KEY.includes('not-for-prod'))) {
            logger_1.logger.warn('⚠️  TOKEN_ENCRYPTION_KEY should be a secure value (minimum 32 characters) in production!');
        }
        else if (!process.env.TOKEN_ENCRYPTION_KEY) {
            logger_1.logger.warn('⚠️  TOKEN_ENCRYPTION_KEY should be set in production for secure token storage!');
        }
    }
    if (isProduction && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*')) {
        const errorMsg = 'CORS_ORIGIN must be set to a specific origin in production! Wildcard (*) disables cookie-based authentication.';
        logger_1.logger.error(`❌ ${errorMsg}`);
        logger_1.logger.error(`❌ With wildcard CORS, credentials mode is disabled. Authentication cookies will not work!`);
        logger_1.logger.error(`💡 Set CORS_ORIGIN to your frontend domain (e.g., https://fringecore.space)`);
        errors.push(errorMsg);
    }
    if (isProduction && process.env.DB_SYNCHRONIZE === 'true') {
        const errorMsg = 'DB_SYNCHRONIZE must be false in production! Enabling this can cause data loss through automatic schema synchronization.';
        logger_1.logger.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
    }
}
function validateDatabaseConfig(errors) {
    const dbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missingDbVars = dbVars.filter(varName => !process.env[varName]);
    if (missingDbVars.length > 0) {
        logger_1.logger.warn(`⚠️  Database environment variables missing: ${missingDbVars.join(', ')}`);
        return;
    }
    const insecurePasswords = [
        'password',
        'postgres',
        'admin',
        '123456',
        'dev_password',
        'test',
        'password123',
        'secret',
        'changeme',
        'pass',
        'root',
        'dev_password_not_for_production',
        '',
    ];
    const dbPassword = process.env.DB_PASSWORD?.toLowerCase() || '';
    if (insecurePasswords.includes(dbPassword)) {
        const errorMsg = 'DB_PASSWORD is set to an insecure default value! Use a strong, unique password in production.';
        logger_1.logger.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
    }
    else if (dbPassword.length < 12) {
        logger_1.logger.warn('⚠️  DB_PASSWORD must be at least 12 characters in production for adequate security!');
    }
    const insecureUsers = ['user', 'admin', 'root', 'dev_user', 'test', 'postgres'];
    if (insecureUsers.includes(process.env.DB_USER?.toLowerCase() || '')) {
        logger_1.logger.warn('⚠️  DB_USER is set to an insecure default value. Use a unique database user in production!');
    }
    if (process.env.DB_SSL === 'false') {
        logger_1.logger.warn('⚠️  WARNING: Database SSL/TLS is disabled in production!');
        logger_1.logger.warn('⚠️  This is a security risk. Enable SSL/TLS for database connections.');
    }
}
const validateEnvironment = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const errors = [];
    validateJwtSecret(isProduction, errors);
    validateSecuritySettings(isProduction, errors);
    if (isProduction) {
        validateDatabaseConfig(errors);
    }
    if (errors.length > 0) {
        logger_1.logger.error(`❌ Environment validation found ${errors.length} critical error(s)`);
        errors.forEach(err => logger_1.logger.error(`   - ${err}`));
        logger_1.logger.warn('⚠️  Server will start but may be unstable. Fix these issues immediately!');
    }
    else if (isProduction) {
        logger_1.logger.info('✓ Environment variables validated successfully for production');
        logger_1.logger.info('✓ Zero Trust security checks passed');
    }
    else {
        logger_1.logger.info('✓ Environment variables validated for development');
    }
    return errors;
};
exports.validateEnvironment = validateEnvironment;
//# sourceMappingURL=security.js.map