"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.circuitBreakerService = exports.CircuitBreakerService = void 0;
const opossum_1 = __importDefault(require("opossum"));
const logger_1 = require("../../utils/logger");
const DEFAULT_OPTIONS = {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
};
class CircuitBreakerService {
    static instance;
    breakers = new Map();
    constructor() {
    }
    static getInstance() {
        if (!CircuitBreakerService.instance) {
            CircuitBreakerService.instance = new CircuitBreakerService();
        }
        return CircuitBreakerService.instance;
    }
    getBreaker(name, action, options = {}, fallback) {
        const existingBreaker = this.breakers.get(name);
        if (existingBreaker) {
            return existingBreaker;
        }
        const breakerOptions = {
            ...DEFAULT_OPTIONS,
            ...options,
            name,
        };
        const breaker = new opossum_1.default(action, breakerOptions);
        this.setupEventHandlers(breaker, name);
        if (fallback) {
            breaker.fallback(fallback);
        }
        this.breakers.set(name, breaker);
        logger_1.logger.info(`Circuit breaker created: ${name}`);
        return breaker;
    }
    async execute(name, action, options = {}, fallback) {
        const breaker = this.getBreaker(name, action, options, fallback);
        return breaker.fire();
    }
    getState(name) {
        const breaker = this.breakers.get(name);
        if (!breaker) {
            return null;
        }
        if (breaker.opened) {
            return 'OPEN';
        }
        if (breaker.halfOpen) {
            return 'HALF_OPEN';
        }
        return 'CLOSED';
    }
    getStats(name) {
        const breaker = this.breakers.get(name);
        if (!breaker) {
            return null;
        }
        const stats = breaker.stats;
        return {
            name,
            state: this.getState(name) ?? 'UNKNOWN',
            stats: {
                successes: stats.successes,
                failures: stats.failures,
                fallbacks: stats.fallbacks,
                timeouts: stats.timeouts,
                cacheHits: stats.cacheHits,
                fires: stats.fires,
                rejects: stats.rejects,
            },
        };
    }
    getAllStats() {
        const allStats = [];
        for (const name of this.breakers.keys()) {
            const stats = this.getStats(name);
            if (stats) {
                allStats.push(stats);
            }
        }
        return allStats;
    }
    reset(name) {
        const breaker = this.breakers.get(name);
        if (!breaker) {
            return false;
        }
        breaker.close();
        logger_1.logger.info(`Circuit breaker reset: ${name}`);
        return true;
    }
    remove(name) {
        const breaker = this.breakers.get(name);
        if (!breaker) {
            return false;
        }
        breaker.shutdown();
        this.breakers.delete(name);
        logger_1.logger.info(`Circuit breaker removed: ${name}`);
        return true;
    }
    clearAll() {
        for (const breaker of this.breakers.values()) {
            breaker.shutdown();
        }
        this.breakers.clear();
        logger_1.logger.info('All circuit breakers cleared');
    }
    setupEventHandlers(breaker, name) {
        breaker.on('open', () => {
            logger_1.logger.warn(`Circuit breaker OPENED: ${name}`, {
                circuitBreaker: name,
                event: 'open',
            });
        });
        breaker.on('halfOpen', () => {
            logger_1.logger.info(`Circuit breaker HALF-OPEN: ${name}`, {
                circuitBreaker: name,
                event: 'halfOpen',
            });
        });
        breaker.on('close', () => {
            logger_1.logger.info(`Circuit breaker CLOSED: ${name}`, {
                circuitBreaker: name,
                event: 'close',
            });
        });
        breaker.on('fallback', () => {
            logger_1.logger.info(`Circuit breaker fallback executed: ${name}`, {
                circuitBreaker: name,
                event: 'fallback',
            });
        });
        breaker.on('timeout', () => {
            logger_1.logger.warn(`Circuit breaker timeout: ${name}`, {
                circuitBreaker: name,
                event: 'timeout',
            });
        });
        breaker.on('reject', () => {
            logger_1.logger.warn(`Circuit breaker rejected request: ${name}`, {
                circuitBreaker: name,
                event: 'reject',
            });
        });
    }
    isHealthy(name) {
        const state = this.getState(name);
        if (state === null) {
            return false;
        }
        return state !== 'OPEN';
    }
    getHealthStatus() {
        const unhealthyCircuits = [];
        for (const name of this.breakers.keys()) {
            if (!this.isHealthy(name)) {
                unhealthyCircuits.push(name);
            }
        }
        return {
            healthy: unhealthyCircuits.length === 0,
            unhealthyCircuits,
        };
    }
}
exports.CircuitBreakerService = CircuitBreakerService;
exports.circuitBreakerService = CircuitBreakerService.getInstance();
//# sourceMappingURL=CircuitBreakerService.js.map