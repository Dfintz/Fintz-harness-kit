"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.domainEvents = exports.DomainEventBus = void 0;
const node_events_1 = require("node:events");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
class DomainEventBus {
    emitter;
    static instance = null;
    constructor() {
        this.emitter = new node_events_1.EventEmitter();
        this.emitter.setMaxListeners(50);
    }
    static getInstance() {
        if (!DomainEventBus.instance) {
            DomainEventBus.instance = new DomainEventBus();
            logger_1.logger.info('📡 DomainEventBus initialized');
        }
        return DomainEventBus.instance;
    }
    static resetInstance() {
        if (DomainEventBus.instance) {
            DomainEventBus.instance.removeAllListeners();
            DomainEventBus.instance = null;
        }
    }
    emit(event, payload) {
        const meta = payload;
        logger_1.logger.debug(`DomainEventBus: emit ${event}`, {
            event,
            organizationId: meta.organizationId,
            userId: meta.userId,
        });
        this.emitter.emit(event, payload);
    }
    safeWrap(event, listener) {
        const wrapped = (payload) => {
            try {
                const result = listener(payload);
                if (result && typeof result.catch === 'function') {
                    result.catch((err) => {
                        logger_1.logger.error(`DomainEventBus: async listener error on '${event}'`, err);
                    });
                }
            }
            catch (err) {
                logger_1.logger.error(`DomainEventBus: sync listener error on '${event}'`, err);
            }
        };
        wrapped.__original = listener;
        return wrapped;
    }
    on(event, listener) {
        logger_1.logger.info('DomainEventBus listener registered', { eventType: event });
        this.emitter.on(event, this.safeWrap(event, listener));
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ADMIN,
            action: 'DOMAIN_EVENT_LISTENER_REGISTERED',
            message: `Domain event listener registered: ${event}`,
            resource: `domain-event/${event}/listener`,
            metadata: {
                eventType: event,
                registeredAt: new Date().toISOString(),
            },
        });
        return this;
    }
    once(event, listener) {
        this.emitter.once(event, this.safeWrap(event, listener));
        return this;
    }
    off(event, listener) {
        const allListeners = this.emitter.listeners(event);
        for (const wrapped of allListeners) {
            if (wrapped.__original === listener) {
                logger_1.logger.info('DomainEventBus listener removed', { eventType: event });
                this.emitter.off(event, wrapped);
                AuditService_1.auditService.log({
                    category: AuditService_1.AuditCategory.ADMIN,
                    action: 'DOMAIN_EVENT_LISTENER_REMOVED',
                    message: `Domain event listener removed: ${event}`,
                    resource: `domain-event/${event}/listener`,
                    metadata: {
                        eventType: event,
                        removedAt: new Date().toISOString(),
                    },
                });
                return this;
            }
        }
        return this;
    }
    removeAllListeners(event) {
        if (event) {
            this.emitter.removeAllListeners(event);
        }
        else {
            this.emitter.removeAllListeners();
        }
        return this;
    }
    listenerCount(event) {
        return this.emitter.listenerCount(event);
    }
    activeEvents() {
        return this.emitter.eventNames();
    }
}
exports.DomainEventBus = DomainEventBus;
exports.domainEvents = DomainEventBus.getInstance();
//# sourceMappingURL=DomainEventBus.js.map