"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSessionBindingToPayload = exports.sessionBindingMiddleware = exports.validateSessionBinding = exports.createSessionBinding = exports.generateBindingHash = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_1 = require("../utils/logger");
const generateBindingHash = (value) => node_crypto_1.default.createHash('sha256').update(value).digest('hex').substring(0, 16);
exports.generateBindingHash = generateBindingHash;
const createSessionBinding = (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    return {
        ipHash: (0, exports.generateBindingHash)(ip),
        uaHash: (0, exports.generateBindingHash)(userAgent),
        deviceHash: deviceFingerprint ? (0, exports.generateBindingHash)(deviceFingerprint) : undefined,
    };
};
exports.createSessionBinding = createSessionBinding;
const defaultConfig = {
    validateIp: process.env.NODE_ENV === 'production',
    validateUserAgent: true,
    validateDeviceFingerprint: true,
    allowSubnetChange: false,
    warnOnly: process.env.SESSION_BINDING_WARN_ONLY === 'true' || process.env.NODE_ENV !== 'production',
};
const validateSessionBinding = (stored, current, config = defaultConfig) => {
    const mismatches = [];
    if (config.validateIp && stored.ipHash !== current.ipHash) {
        mismatches.push('IP address changed');
    }
    if (config.validateUserAgent && stored.uaHash !== current.uaHash) {
        mismatches.push('User-Agent changed');
    }
    if (config.validateDeviceFingerprint &&
        stored.deviceHash &&
        current.deviceHash &&
        stored.deviceHash !== current.deviceHash) {
        mismatches.push('Device fingerprint changed');
    }
    return {
        valid: mismatches.length === 0,
        mismatches,
    };
};
exports.validateSessionBinding = validateSessionBinding;
const sessionBindingMiddleware = (config = {}) => {
    const finalConfig = { ...defaultConfig, ...config };
    return (req, res, next) => {
        if (!req.user) {
            return next();
        }
        const storedBinding = req.user.sessionBinding;
        if (!storedBinding) {
            return next();
        }
        const currentBinding = (0, exports.createSessionBinding)(req);
        const validation = (0, exports.validateSessionBinding)(storedBinding, currentBinding, finalConfig);
        if (!validation.valid) {
            const logLevel = finalConfig.warnOnly ? 'debug' : 'warn';
            logger_1.logger[logLevel]('Session binding mismatch detected', {
                userId: req.user.id,
                mismatches: validation.mismatches,
                path: req.path,
                method: req.method,
                ip: req.ip,
            });
            if (finalConfig.warnOnly) {
                return next();
            }
            res.status(403).json({
                error: 'Session binding validation failed',
                message: 'Your session may have been compromised. Please log in again.',
                code: 'SESSION_BINDING_MISMATCH',
            });
            return;
        }
        next();
    };
};
exports.sessionBindingMiddleware = sessionBindingMiddleware;
const addSessionBindingToPayload = (payload, req) => ({
    ...payload,
    sessionBinding: (0, exports.createSessionBinding)(req),
});
exports.addSessionBindingToPayload = addSessionBindingToPayload;
//# sourceMappingURL=sessionBinding.js.map