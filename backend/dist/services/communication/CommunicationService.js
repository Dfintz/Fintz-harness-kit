"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunicationService = void 0;
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const notifications_1 = require("./notifications");
const realtime_1 = require("./realtime");
const tickets_1 = require("./tickets");
const voice_1 = require("./voice");
const VoiceServerService_1 = require("./voice/VoiceServerService");
const webhooks_1 = require("./webhooks");
class CommunicationService {
    static instance;
    _notificationService;
    _ticketService;
    _webhookService;
    _voiceService;
    _realtimeService;
    config;
    constructor(config = {}) {
        this.config = {
            enableNotifications: true,
            enableTickets: true,
            enableWebhooks: true,
            enableVoice: true,
            enableRealtime: true,
            ...config,
        };
        logger_1.logger.info('CommunicationService facade initialized');
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ADMIN,
            action: 'COMMUNICATION_FACADE_INITIALIZED',
            message: 'CommunicationService facade initialized',
            resource: 'communication/facade',
            metadata: {
                config: this.config,
            },
        });
    }
    static getInstance(config) {
        if (!CommunicationService.instance) {
            CommunicationService.instance = new CommunicationService(config);
        }
        return CommunicationService.instance;
    }
    get notifications() {
        if (!this._notificationService) {
            if (!this.config.enableNotifications) {
                throw new Error('Notification service is disabled');
            }
            this._notificationService = new notifications_1.NotificationService();
            logger_1.logger.info('CommunicationService initialized NotificationService');
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
                action: 'COMMUNICATION_NOTIFICATION_SERVICE_INITIALIZED',
                message: 'Initialized NotificationService via CommunicationService facade',
                resource: 'communication/notifications',
            });
        }
        return this._notificationService;
    }
    get tickets() {
        if (!this._ticketService) {
            if (!this.config.enableTickets) {
                throw new Error('Ticket service is disabled');
            }
            this._ticketService = tickets_1.TicketService.getInstance();
            logger_1.logger.info('CommunicationService initialized TicketService');
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
                action: 'COMMUNICATION_TICKET_SERVICE_INITIALIZED',
                message: 'Initialized TicketService via CommunicationService facade',
                resource: 'communication/tickets',
            });
        }
        return this._ticketService;
    }
    get webhooks() {
        if (!this._webhookService) {
            if (!this.config.enableWebhooks) {
                throw new Error('Webhook service is disabled');
            }
            this._webhookService = new webhooks_1.WebhookService();
            logger_1.logger.info('CommunicationService initialized WebhookService');
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ADMIN,
                action: 'COMMUNICATION_WEBHOOK_SERVICE_INITIALIZED',
                message: 'Initialized WebhookService via CommunicationService facade',
                resource: 'communication/webhooks',
            });
        }
        return this._webhookService;
    }
    get voice() {
        if (!this.config.enableVoice) {
            throw new Error('Voice service is disabled');
        }
        return voice_1.VoiceChannelService.getInstance();
    }
    get voiceServer() {
        return VoiceServerService_1.VoiceServerService.getInstance();
    }
    get realtime() {
        if (!this.config.enableRealtime) {
            throw new Error('Realtime service is disabled');
        }
        return realtime_1.WebSocketService.getInstance();
    }
    getStatus() {
        return {
            notifications: {
                enabled: this.config.enableNotifications ?? true,
                configured: !!this._notificationService,
            },
            tickets: {
                enabled: this.config.enableTickets ?? true,
                configured: !!this._ticketService,
            },
            webhooks: {
                enabled: this.config.enableWebhooks ?? true,
                configured: !!this._webhookService,
            },
            voice: {
                enabled: this.config.enableVoice ?? true,
                configured: true,
            },
            realtime: {
                enabled: this.config.enableRealtime ?? true,
                configured: true,
            },
        };
    }
    static resetInstance() {
        CommunicationService.instance = undefined;
        logger_1.logger.info('CommunicationService facade instance reset');
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ADMIN,
            action: 'COMMUNICATION_FACADE_RESET',
            message: 'CommunicationService facade instance reset',
            resource: 'communication/facade',
        });
    }
}
exports.CommunicationService = CommunicationService;
//# sourceMappingURL=CommunicationService.js.map