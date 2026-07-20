"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalServiceAuthOptional = exports.internalServiceAuthRequired = void 0;
exports.initializeServiceRegistry = initializeServiceRegistry;
exports.loadServiceRegistryFromEnv = loadServiceRegistryFromEnv;
exports.getService = getService;
exports.generateInternalServiceSignature = generateInternalServiceSignature;
exports.validateInternalServiceRequest = validateInternalServiceRequest;
exports.requireInternalServiceAuth = requireInternalServiceAuth;
exports.optionalInternalServiceAuth = optionalInternalServiceAuth;
exports.generateServiceNonce = generateServiceNonce;
exports.signInternalServiceRequest = signInternalServiceRequest;
exports.isInternalServiceRequest = isInternalServiceRequest;
exports.getInternalServiceIdentity = getInternalServiceIdentity;
const crypto_1 = __importDefault(require("crypto"));
const NonceStorage_1 = require("../services/security/core/NonceStorage");
const logger_1 = require("../utils/logger");
const SERVICE_ID_HEADER = 'x-service-id';
const SERVICE_SIGNATURE_HEADER = 'x-service-signature';
const SERVICE_TIMESTAMP_HEADER = 'x-service-timestamp';
const SERVICE_NONCE_HEADER = 'x-service-nonce';
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const SERVICE_NONCE_PREFIX = 'svc_nonce:';
const UNSUPPORTED_PATTERN_TOKENS = /[(){}[\]|+]/;
const buildSafeEndpointRegex = (pattern) => {
    const trimmed = pattern.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed === '*' || trimmed === '.*' || trimmed === '/*') {
        return /^.*$/;
    }
    if (UNSUPPORTED_PATTERN_TOKENS.test(trimmed)) {
        return null;
    }
    if (trimmed.length > 200) {
        return null;
    }
    let escaped = '';
    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        const next = trimmed[i + 1];
        if (char === '.' && next === '*') {
            escaped += '.*';
            i++;
        }
        else if (char === '*' && trimmed[i - 1] !== '.') {
            escaped += '.*';
        }
        else if (/[+?^${}|()[\]\\]/.test(char)) {
            escaped += `\\${char}`;
        }
        else {
            escaped += char;
        }
    }
    const anchored = escaped.startsWith('^') ? escaped : `^${escaped}`;
    const finalPattern = anchored.endsWith('$') ? anchored : `${anchored}$`;
    return new RegExp(finalPattern);
};
const matchesAllowedEndpoint = (path, allowedPatterns) => allowedPatterns.some(pattern => {
    const safeRegex = buildSafeEndpointRegex(pattern);
    if (!safeRegex) {
        logger_1.logger.warn('Blocked unsafe endpoint pattern for internal service', {
            pattern,
            path,
        });
        return false;
    }
    if (path.length > 2000) {
        logger_1.logger.warn('Path too long for safe matching', { pathLength: path.length });
        return false;
    }
    return safeRegex.test(path);
});
const serviceRegistry = new Map();
function initializeServiceRegistry(services) {
    for (const service of services) {
        serviceRegistry.set(service.serviceId, service);
        logger_1.logger.info(`Registered internal service: ${service.serviceName} (${service.serviceId})`);
    }
    logger_1.logger.info(`Internal service registry initialized with ${services.length} services`);
}
function loadServiceRegistryFromEnv() {
    const servicesJson = process.env.INTERNAL_SERVICES;
    if (!servicesJson) {
        logger_1.logger.debug('No internal services configured');
        return;
    }
    try {
        const services = JSON.parse(servicesJson);
        initializeServiceRegistry(services);
    }
    catch (err) {
        logger_1.logger.error('Failed to parse INTERNAL_SERVICES environment variable', { error: err });
    }
}
function getService(serviceId) {
    return serviceRegistry.get(serviceId) ?? null;
}
function generateInternalServiceSignature(serviceId, method, path, timestamp, body, secret) {
    const payload = `${serviceId}.${timestamp}.${method.toUpperCase()}.${path}.${body}`;
    return crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
}
async function validateInternalServiceRequest(req) {
    const serviceId = req.headers[SERVICE_ID_HEADER];
    const signature = req.headers[SERVICE_SIGNATURE_HEADER];
    const timestamp = req.headers[SERVICE_TIMESTAMP_HEADER];
    const nonce = req.headers[SERVICE_NONCE_HEADER];
    if (!serviceId) {
        return { isValid: false, error: 'Missing service ID header' };
    }
    if (!signature) {
        return { isValid: false, error: 'Missing service signature header' };
    }
    if (!timestamp) {
        return { isValid: false, error: 'Missing service timestamp header' };
    }
    if (!nonce) {
        return { isValid: false, error: 'Missing service nonce header (replay protection required)' };
    }
    const service = serviceRegistry.get(serviceId);
    if (!service) {
        logger_1.logger.warn(`Unknown service ID attempted authentication: ${serviceId}`, {
            ip: req.ip,
            path: req.path,
        });
        return { isValid: false, error: 'Unknown service ID' };
    }
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime)) {
        return { isValid: false, error: 'Invalid timestamp format' };
    }
    const now = Date.now();
    const drift = Math.abs(now - requestTime);
    if (drift > MAX_TIMESTAMP_DRIFT_MS) {
        return { isValid: false, error: 'Request timestamp expired or too far in future' };
    }
    const nonceStorage = (0, NonceStorage_1.getNonceStorage)();
    const nonceKey = `${SERVICE_NONCE_PREFIX}${nonce}`;
    const isReplay = await nonceStorage.checkAndMark(nonceKey, requestTime);
    if (isReplay) {
        logger_1.logger.warn(`Service replay attack prevented for ${service.serviceName}`, {
            serviceId,
            nonce,
            ip: req.ip,
        });
        return { isValid: false, error: 'Request nonce already used (replay attack prevented)' };
    }
    const isEndpointAllowed = matchesAllowedEndpoint(req.path, service.allowedEndpoints);
    if (!isEndpointAllowed) {
        logger_1.logger.warn(`Service ${service.serviceName} attempted unauthorized endpoint access`, {
            serviceId,
            path: req.path,
            allowedEndpoints: service.allowedEndpoints,
        });
        return {
            isValid: false,
            serviceId,
            serviceName: service.serviceName,
            error: 'Service not authorized for this endpoint',
        };
    }
    const body = req.body ? JSON.stringify(req.body) : '';
    const expectedSignature = generateInternalServiceSignature(serviceId, req.method, req.path, timestamp, body, service.secret);
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) {
        return {
            isValid: false,
            serviceId,
            serviceName: service.serviceName,
            error: 'Invalid signature',
        };
    }
    if (!crypto_1.default.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger_1.logger.warn(`Invalid signature from service ${service.serviceName}`, {
            serviceId,
            path: req.path,
            ip: req.ip,
        });
        return {
            isValid: false,
            serviceId,
            serviceName: service.serviceName,
            error: 'Invalid signature',
        };
    }
    return {
        isValid: true,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
    };
}
function requireInternalServiceAuth() {
    return async (req, res, next) => {
        if (serviceRegistry.size === 0) {
            if (process.env.NODE_ENV === 'production') {
                logger_1.logger.error('Internal service authentication required but no services configured');
                res.status(500).json({ error: 'Internal service authentication not configured' });
                return;
            }
            logger_1.logger.debug('Internal service auth skipped - no services configured');
            next();
            return;
        }
        const result = await validateInternalServiceRequest(req);
        if (!result.isValid) {
            logger_1.logger.warn(`Internal service authentication failed: ${result.error}`, {
                path: req.path,
                method: req.method,
                ip: req.ip,
                serviceId: result.serviceId,
            });
            res.status(401).json({
                error: 'Internal service authentication failed',
                details: result.error,
            });
            return;
        }
        const serviceReq = req;
        if (result.serviceId && result.serviceName) {
            serviceReq.internalService = {
                serviceId: result.serviceId,
                serviceName: result.serviceName,
            };
        }
        logger_1.logger.debug(`Internal service authenticated: ${result.serviceName}`, {
            serviceId: result.serviceId,
            path: req.path,
            method: req.method,
        });
        next();
    };
}
function optionalInternalServiceAuth() {
    return async (req, res, next) => {
        const hasServiceId = !!req.headers[SERVICE_ID_HEADER];
        if (!hasServiceId) {
            next();
            return;
        }
        const result = await validateInternalServiceRequest(req);
        if (!result.isValid) {
            logger_1.logger.warn(`Optional internal service authentication failed: ${result.error}`, {
                path: req.path,
                method: req.method,
                ip: req.ip,
                serviceId: result.serviceId,
            });
            res.status(401).json({
                error: 'Internal service authentication failed',
                details: result.error,
            });
            return;
        }
        const serviceReq = req;
        if (result.serviceId && result.serviceName) {
            serviceReq.internalService = {
                serviceId: result.serviceId,
                serviceName: result.serviceName,
            };
        }
        next();
    };
}
function generateServiceNonce() {
    return crypto_1.default.randomBytes(16).toString('hex');
}
function signInternalServiceRequest(serviceId, method, path, body, secret) {
    const timestamp = Date.now().toString();
    const nonce = generateServiceNonce();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = generateInternalServiceSignature(serviceId, method, path, timestamp, bodyStr, secret);
    return {
        [SERVICE_ID_HEADER]: serviceId,
        [SERVICE_SIGNATURE_HEADER]: signature,
        [SERVICE_TIMESTAMP_HEADER]: timestamp,
        [SERVICE_NONCE_HEADER]: nonce,
    };
}
function isInternalServiceRequest(req) {
    return !!req.internalService;
}
function getInternalServiceIdentity(req) {
    return req.internalService ?? null;
}
exports.internalServiceAuthRequired = requireInternalServiceAuth();
exports.internalServiceAuthOptional = optionalInternalServiceAuth();
//# sourceMappingURL=internalServiceAuth.js.map