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
export declare class CommunicationService {
    private static instance;
    private _notificationService?;
    private _ticketService?;
    private _webhookService?;
    private _voiceService?;
    private _realtimeService?;
    private readonly config;
    private constructor();
    static getInstance(config?: CommunicationServiceConfig): CommunicationService;
    get notifications(): NotificationService;
    get tickets(): TicketService;
    get webhooks(): WebhookService;
    get voice(): VoiceChannelService;
    get voiceServer(): VoiceServerService;
    get realtime(): WebSocketService;
    getStatus(): {
        notifications: {
            enabled: boolean;
            configured: boolean;
        };
        tickets: {
            enabled: boolean;
            configured: boolean;
        };
        webhooks: {
            enabled: boolean;
            configured: boolean;
        };
        voice: {
            enabled: boolean;
            configured: boolean;
        };
        realtime: {
            enabled: boolean;
            configured: boolean;
        };
    };
    static resetInstance(): void;
}
//# sourceMappingURL=CommunicationService.d.ts.map