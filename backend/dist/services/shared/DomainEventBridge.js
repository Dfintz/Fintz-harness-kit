"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDomainEventBridge = initializeDomainEventBridge;
exports.shutdownDomainEventBridge = shutdownDomainEventBridge;
const node_crypto_1 = __importDefault(require("node:crypto"));
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const DomainEventBus_1 = require("./DomainEventBus");
const CHANNEL = 'domain-events:bridge';
const PROCESS_ID = node_crypto_1.default.randomUUID();
const recentEventIds = new Set();
const MAX_RECENT_IDS = 1000;
const bridgeListeners = new Map();
let pubClient = null;
let subClient = null;
let initialized = false;
let pubTokenRefreshHandle = null;
let subTokenRefreshHandle = null;
const BRIDGED_EVENTS = [
    'member:discord_left',
    'member:discord_role_changed',
    'member:discord_timeout',
    'member:discord_unlinked',
    'member:moderation_action',
    'member:primary_org_switched',
    'member:platform_left',
    'member:rsi_org_left',
    'member:rsi_org_joined',
    'member:rsi_rank_changed',
    'member:rsi_handle_changed',
    'activity:created',
    'activity:completed',
    'activity:cancelled',
    'activity:rescheduled',
    'activity:updated',
    'activity:deleted',
    'team:member_added',
    'team:member_removed',
    'availability:updated',
];
function isBridgeMessage(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const record = value;
    return (typeof record.id === 'string' &&
        typeof record.sourceProcessId === 'string' &&
        typeof record.event === 'string' &&
        typeof record.payload === 'string');
}
function detachBridgeListeners() {
    for (const [eventName, listener] of bridgeListeners) {
        DomainEventBus_1.domainEvents.off(eventName, listener);
    }
    bridgeListeners.clear();
}
async function initializeDomainEventBridge() {
    if (initialized) {
        return;
    }
    const config = await (0, redis_1.getRedisConfigAsync)();
    if (!config) {
        logger_1.logger.warn('DomainEventBridge: Redis not configured, skipping bridge initialization');
        return;
    }
    try {
        pubClient = new ioredis_1.default(config);
        subClient = new ioredis_1.default(config);
        (0, redis_1.attachRedisErrorObserver)(pubClient, 'DomainEventBridge publisher', () => {
            void pubTokenRefreshHandle?.refreshNow();
        });
        (0, redis_1.attachRedisErrorObserver)(subClient, 'DomainEventBridge subscriber', () => {
            void subTokenRefreshHandle?.refreshNow();
        });
        pubTokenRefreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(pubClient, 'DomainEventBridge publisher');
        subTokenRefreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(subClient, 'DomainEventBridge subscriber');
        await subClient.subscribe(CHANNEL);
        subClient.on('message', (_channel, message) => {
            try {
                const parsedUnknown = JSON.parse(message);
                if (!isBridgeMessage(parsedUnknown)) {
                    logger_1.logger.warn('DomainEventBridge: dropped malformed bridge message');
                    return;
                }
                const parsed = parsedUnknown;
                if (parsed.sourceProcessId === PROCESS_ID) {
                    return;
                }
                if (recentEventIds.has(parsed.id)) {
                    return;
                }
                const payloadUnknown = JSON.parse(parsed.payload);
                const payload = payloadUnknown;
                DomainEventBus_1.domainEvents.emit(parsed.event, payload);
                logger_1.logger.debug('DomainEventBridge: received cross-process event', {
                    event: parsed.event,
                    source: parsed.sourceProcessId.slice(0, 8),
                });
            }
            catch (err) {
                logger_1.logger.warn('DomainEventBridge: failed to process message', { error: String(err) });
            }
        });
        for (const eventName of BRIDGED_EVENTS) {
            const listener = payload => {
                if (!pubClient) {
                    return;
                }
                const eventId = node_crypto_1.default.randomUUID();
                recentEventIds.add(eventId);
                if (recentEventIds.size > MAX_RECENT_IDS) {
                    const firstId = recentEventIds.values().next().value;
                    if (firstId) {
                        recentEventIds.delete(firstId);
                    }
                }
                const message = {
                    id: eventId,
                    sourceProcessId: PROCESS_ID,
                    event: eventName,
                    payload: JSON.stringify(payload),
                };
                pubClient.publish(CHANNEL, JSON.stringify(message)).catch(err => {
                    logger_1.logger.warn('DomainEventBridge: failed to publish event', {
                        event: eventName,
                        error: String(err),
                    });
                });
            };
            bridgeListeners.set(eventName, listener);
            DomainEventBus_1.domainEvents.on(eventName, listener);
        }
        initialized = true;
        logger_1.logger.info(`DomainEventBridge: initialized (processId=${PROCESS_ID.slice(0, 8)}, ${BRIDGED_EVENTS.length} events bridged)`);
    }
    catch (error) {
        detachBridgeListeners();
        recentEventIds.clear();
        pubTokenRefreshHandle?.stop();
        subTokenRefreshHandle?.stop();
        pubTokenRefreshHandle = null;
        subTokenRefreshHandle = null;
        logger_1.logger.error('DomainEventBridge: initialization failed', {
            error: (0, redis_1.sanitizeRedisErrorForLogging)(error),
        });
    }
}
async function shutdownDomainEventBridge() {
    detachBridgeListeners();
    recentEventIds.clear();
    pubTokenRefreshHandle?.stop();
    subTokenRefreshHandle?.stop();
    pubTokenRefreshHandle = null;
    subTokenRefreshHandle = null;
    if (subClient) {
        await subClient.unsubscribe(CHANNEL).catch(() => { });
        subClient.disconnect();
        subClient = null;
    }
    if (pubClient) {
        pubClient.disconnect();
        pubClient = null;
    }
    initialized = false;
    logger_1.logger.info('DomainEventBridge: shut down');
}
//# sourceMappingURL=DomainEventBridge.js.map