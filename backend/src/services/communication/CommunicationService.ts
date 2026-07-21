/**
 * CommunicationService - Unified Facade
 *
 * Provides a unified interface to all communication-related services:
 * - Notifications (Discord, Email)
 * - Tickets (Support ticket system)
 * - Webhooks (Event-driven integrations)
 * - Voice (Voice channel management)
 * - Realtime (WebSocket communication)
 */

import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

import { NotificationService } from './notifications';
import { WebSocketService } from './realtime';
import { TicketService } from './tickets';
import { VoiceChannelService } from './voice';
import { VoiceServerService } from './voice/VoiceServerService';
import { WebhookService } from './webhooks';

export interface CommunicationServiceConfig {
  enableNotifications?: boolean;
  enableTickets?: boolean;
  enableWebhooks?: boolean;
  enableVoice?: boolean;
  enableVoiceServer?: boolean;
  enableRealtime?: boolean;
}

/**
 * CommunicationService Facade
 *
 * This facade provides a unified entry point to all communication services.
 * It allows for easy access to sub-services while maintaining the ability
 * to configure and manage them centrally.
 */
export class CommunicationService {
  private static instance: CommunicationService;

  private _notificationService?: NotificationService;
  private _ticketService?: TicketService;
  private _webhookService?: WebhookService;
  private _voiceService?: VoiceChannelService;
  private _realtimeService?: WebSocketService;

  private readonly config: CommunicationServiceConfig;

  private constructor(config: CommunicationServiceConfig = {}) {
    this.config = {
      enableNotifications: true,
      enableTickets: true,
      enableWebhooks: true,
      enableVoice: true,
      enableRealtime: true,
      ...config,
    };

    logger.info('CommunicationService facade initialized');

    auditService.log({
      category: AuditCategory.ADMIN,
      action: 'COMMUNICATION_FACADE_INITIALIZED',
      message: 'CommunicationService facade initialized',
      resource: 'communication/facade',
      metadata: {
        config: this.config,
      },
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: CommunicationServiceConfig): CommunicationService {
    if (!CommunicationService.instance) {
      CommunicationService.instance = new CommunicationService(config);
    }
    return CommunicationService.instance;
  }

  /**
   * Get NotificationService instance
   */
  public get notifications(): NotificationService {
    if (!this._notificationService) {
      if (!this.config.enableNotifications) {
        throw new Error('Notification service is disabled');
      }
      this._notificationService = new NotificationService();

      logger.info('CommunicationService initialized NotificationService');

      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'COMMUNICATION_NOTIFICATION_SERVICE_INITIALIZED',
        message: 'Initialized NotificationService via CommunicationService facade',
        resource: 'communication/notifications',
      });
    }
    return this._notificationService;
  }

  /**
   * Get TicketService instance
   */
  public get tickets(): TicketService {
    if (!this._ticketService) {
      if (!this.config.enableTickets) {
        throw new Error('Ticket service is disabled');
      }
      this._ticketService = TicketService.getInstance();

      logger.info('CommunicationService initialized TicketService');

      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'COMMUNICATION_TICKET_SERVICE_INITIALIZED',
        message: 'Initialized TicketService via CommunicationService facade',
        resource: 'communication/tickets',
      });
    }
    return this._ticketService;
  }

  /**
   * Get WebhookService instance
   */
  public get webhooks(): WebhookService {
    if (!this._webhookService) {
      if (!this.config.enableWebhooks) {
        throw new Error('Webhook service is disabled');
      }
      this._webhookService = new WebhookService();

      logger.info('CommunicationService initialized WebhookService');

      auditService.log({
        category: AuditCategory.ADMIN,
        action: 'COMMUNICATION_WEBHOOK_SERVICE_INITIALIZED',
        message: 'Initialized WebhookService via CommunicationService facade',
        resource: 'communication/webhooks',
      });
    }
    return this._webhookService;
  }

  /**
   * Get VoiceChannelService instance
   */
  public get voice(): VoiceChannelService {
    if (!this.config.enableVoice) {
      throw new Error('Voice service is disabled');
    }
    return VoiceChannelService.getInstance();
  }

  /**
   * Get VoiceServerService instance (external voice servers: Mumble, TeamSpeak)
   */
  public get voiceServer(): VoiceServerService {
    return VoiceServerService.getInstance();
  }

  /**
   * Get WebSocketService instance
   */
  public get realtime(): WebSocketService {
    if (!this.config.enableRealtime) {
      throw new Error('Realtime service is disabled');
    }
    return WebSocketService.getInstance();
  }

  /**
   * Get service status
   */
  public getStatus(): {
    notifications: { enabled: boolean; configured: boolean };
    tickets: { enabled: boolean; configured: boolean };
    webhooks: { enabled: boolean; configured: boolean };
    voice: { enabled: boolean; configured: boolean };
    realtime: { enabled: boolean; configured: boolean };
  } {
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
        configured: true, // Singleton, always available
      },
      realtime: {
        enabled: this.config.enableRealtime ?? true,
        configured: true, // Singleton, always available
      },
    };
  }

  /**
   * Reset instance (mainly for testing)
   */
  public static resetInstance(): void {
    CommunicationService.instance = undefined as unknown as CommunicationService;

    logger.info('CommunicationService facade instance reset');

    auditService.log({
      category: AuditCategory.ADMIN,
      action: 'COMMUNICATION_FACADE_RESET',
      message: 'CommunicationService facade instance reset',
      resource: 'communication/facade',
    });
  }
}
