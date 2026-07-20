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
exports.StarCommsClientFactory = void 0;
const axios_1 = __importDefault(require("axios"));
const defaultModuleLoader = async () => (await Promise.resolve().then(() => __importStar(require('@30k/starcomm-client'))));
const defaultCreateHttpClient = (baseUrl, timeoutMs, apiKey) => {
    const headers = {};
    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }
    return axios_1.default.create({
        baseURL: baseUrl,
        timeout: timeoutMs,
        headers,
    });
};
class StarCommsClientFactory {
    moduleLoader;
    createHttpClient;
    constructor(moduleLoader = defaultModuleLoader, createHttpClient = defaultCreateHttpClient) {
        this.moduleLoader = moduleLoader;
        this.createHttpClient = createHttpClient;
    }
    normalizeBaseUrl(baseUrl) {
        const normalized = new URL(baseUrl);
        normalized.pathname = normalized.pathname.replace(/\/$/, '');
        return normalized.toString();
    }
    async createClient(config) {
        const timeoutMs = config.timeoutMs ?? 5000;
        const baseUrl = this.normalizeBaseUrl(config.baseUrl);
        const httpClient = this.createHttpClient(baseUrl, timeoutMs, config.apiKey);
        const sdkClient = await this.tryCreateSdkClient(baseUrl, timeoutMs, config.apiKey);
        return {
            getStatus: async () => {
                if (sdkClient) {
                    const sdkStatus = await this.callSdkStatus(sdkClient);
                    if (sdkStatus) {
                        return sdkStatus;
                    }
                }
                const response = await httpClient.get('/status');
                return this.toRecord(response.data);
            },
            getMetrics: async (params) => {
                if (sdkClient) {
                    const sdkMetrics = await this.callSdkMetrics(sdkClient, params);
                    if (sdkMetrics) {
                        return sdkMetrics;
                    }
                }
                const response = await httpClient.get('/metrics', { params });
                return this.toRecord(response.data);
            },
            openOperation: async (req) => {
                const response = await httpClient.post('/api/v1/operation', req);
                return this.toRecord(response.data);
            },
            bulkAssign: async (req) => {
                const response = await httpClient.post('/api/v1/assignments/bulk', req);
                return this.toRecord(response.data);
            },
            broadcastAcars: async (req) => {
                const response = await httpClient.post('/api/v1/acars', req);
                return this.toRecord(response.data);
            },
        };
    }
    async tryCreateSdkClient(baseUrl, timeoutMs, apiKey) {
        try {
            const sdkModule = await this.moduleLoader();
            const config = {
                baseUrl,
                timeout: timeoutMs,
            };
            if (apiKey) {
                config.apiKey = apiKey;
            }
            if (sdkModule.createClient) {
                return sdkModule.createClient(config);
            }
            if (sdkModule.StarCommClient) {
                return new sdkModule.StarCommClient(config);
            }
            if (sdkModule.default) {
                return new sdkModule.default(config);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async callSdkStatus(client) {
        if (client.getStatus) {
            return this.toRecord(await client.getStatus());
        }
        if (client.status) {
            return this.toRecord(await client.status());
        }
        return null;
    }
    async callSdkMetrics(client, params) {
        const metricsParams = { ...params };
        if (client.getMetrics) {
            return this.toRecord(await client.getMetrics(metricsParams));
        }
        if (client.metrics) {
            return this.toRecord(await client.metrics(metricsParams));
        }
        return null;
    }
    toRecord(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
}
exports.StarCommsClientFactory = StarCommsClientFactory;
//# sourceMappingURL=StarCommsClientFactory.js.map