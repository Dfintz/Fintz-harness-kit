/**
 * Communication Domain Services
 * Unified communication management including notifications, tickets, webhooks, voice, realtime, and announcements
 */

// Unified facade
export { CommunicationService } from './CommunicationService';
export type { CommunicationServiceConfig } from './CommunicationService';

// Notifications sub-module
export { collectDeliveredNotifications, NotificationService } from './notifications';
export type { EmailConfig, NotificationMessage, NotificationResult } from './notifications';

// Notification Scheduling
export {
  NotificationSchedulerService,
  ScheduledNotificationPriority,
  ScheduledNotificationStatus,
} from './notifications';
export type {
  CreateScheduledNotificationParams,
  NotificationChannel,
  ScheduledNotification,
  ScheduledNotificationFilters,
  SchedulerStats,
} from './notifications';

// Notification Digest
export {
  DigestFrequency,
  DigestStatus,
  NotificationCategory,
  NotificationDigestService,
} from './notifications';
export type {
  DigestCategorySummary,
  DigestChannel,
  DigestNotification,
  DigestStats,
  NotificationDigest,
  UserDigestPreferences,
} from './notifications';

// Tickets sub-module
export { TicketService } from './tickets';
export type {
  AddMessageDTO,
  CreateTicketDTO,
  ResolveTicketDTO,
  TicketFilters,
  UpdateTicketDTO,
} from './tickets';

// Webhooks sub-module
export { WebhookService } from './webhooks';

// Voice sub-module
export { VoiceChannelService } from './voice';
export { VoiceAuditLogger, voiceAuditLogger } from './voice/VoiceAuditLogger';
export { VoiceServerService } from './voice/VoiceServerService';

// Realtime sub-module
export { WebSocketService } from './realtime';
export type { TunnelMessage } from './realtime';

// StarComms sub-module
export { StarCommsAdapter, StarCommsClientFactory } from './starcomms';
export {
  StarCommsAccessService,
  StarCommsContextSyncService,
  StarCommsFederationService,
} from './starcomms';
export type {
  StarCommsClient,
  StarCommsConnectionConfig,
  StarCommsMetricsSnapshot,
  StarCommsMetricsWindowRequest,
  StarCommsOperationResult,
  StarCommsStatusSnapshot,
} from './starcomms';

// Email sub-module
export { EmailService, emailService } from './email';
export type { SendEmailOptions, SendEmailResult } from './email';

// Announcements sub-module (Phase 2: Multi-Server & Scheduling)
export { AnnouncementService } from './announcement';
export type {
  AnnouncementFilters,
  AnnouncementStatusResult,
  CreateAnnouncementDTO,
  // Phase 4 exports
  CreateTemplateDTO,
  DeliveryResult,
  EmbedPreview,
  GlobalBroadcastResult,
  MultiServerDeliveryResult,
  TemplateFilters,
  UpdateAnnouncementDTO,
  UpdateTemplateDTO,
} from './announcement';
