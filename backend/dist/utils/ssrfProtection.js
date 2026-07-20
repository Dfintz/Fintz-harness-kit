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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPrivateHost = isPrivateHost;
exports.isPrivateHostResolved = isPrivateHostResolved;
const logger_1 = require("./logger");
const PRIVATE_IP_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
];
function isPrivateHost(host) {
    const lower = host.toLowerCase();
    if (lower === 'localhost' || lower === '0.0.0.0' || lower === '::1') {
        return true;
    }
    if (lower === '169.254.169.254' ||
        lower === '168.63.129.16' ||
        lower === 'metadata.google.internal') {
        return true;
    }
    return PRIVATE_IP_RANGES.some(r => r.test(host));
}
async function isPrivateHostResolved(host) {
    if (isPrivateHost(host)) {
        return true;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        return false;
    }
    try {
        const dns = await Promise.resolve().then(() => __importStar(require('node:dns/promises')));
        const addresses = await dns.resolve4(host);
        return addresses.some(ip => isPrivateHost(ip));
    }
    catch {
        logger_1.logger.warn('DNS resolution failed for outbound host, blocking as precaution', { host });
        return true;
    }
}
//# sourceMappingURL=ssrfProtection.js.map