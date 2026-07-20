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
exports.ApplicationInsightsTransport = void 0;
const appInsights = __importStar(require("applicationinsights"));
const winston_transport_1 = __importDefault(require("winston-transport"));
const securityUtils_1 = require("./securityUtils");
class ApplicationInsightsTransport extends winston_transport_1.default {
    client;
    constructor(options) {
        super(options);
        this.client = appInsights.defaultClient;
    }
    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });
        if (!this.client) {
            callback();
            return;
        }
        const { level, message, timestamp, ...metadata } = info;
        const lvl = level;
        const ts = timestamp;
        try {
            const severityLevel = this.mapSeverityLevel(lvl);
            const sanitizedMetadata = this.sanitizeMetadata(metadata);
            const properties = {
                service: 'sc-fleet-manager',
                level: lvl,
                timestamp: ts || new Date().toISOString(),
            };
            Object.entries(sanitizedMetadata).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    properties[key] = this.toPropertyValue(value);
                }
            });
            if (lvl === 'error' && info instanceof Error) {
                this.client.trackException({
                    exception: info,
                    properties,
                    severity: severityLevel,
                });
            }
            else {
                this.client.trackTrace({
                    message: String(message),
                    severity: severityLevel,
                    properties,
                });
            }
            if (lvl === 'error' || lvl === 'fatal') {
                void this.client.flush();
            }
        }
        catch (error) {
            console.error('Error sending log to Application Insights:', error);
        }
        callback();
    }
    mapSeverityLevel(level) {
        const Severity = {
            Verbose: 'Verbose',
            Information: 'Information',
            Warning: 'Warning',
            Error: 'Error',
            Critical: 'Critical',
        };
        switch (level) {
            case 'error':
                return Severity.Error;
            case 'warn':
                return Severity.Warning;
            case 'debug':
                return Severity.Verbose;
            case 'info':
            default:
                return Severity.Information;
        }
    }
    sanitizeMetadata(metadata) {
        const sanitized = {};
        for (const [key, value] of Object.entries(metadata)) {
            try {
                const entry = (0, securityUtils_1.sanitizeObject)({ [key]: value });
                sanitized[key] = entry[key];
            }
            catch {
                sanitized[key] = '[Unserializable metadata]';
            }
        }
        return sanitized;
    }
    toPropertyValue(value) {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
            return String(value);
        }
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            }
            catch {
                return '[Unserializable metadata]';
            }
        }
        return '[Unsupported metadata type]';
    }
}
exports.ApplicationInsightsTransport = ApplicationInsightsTransport;
//# sourceMappingURL=ApplicationInsightsTransport.js.map