import { NotificationService } from '../communication';
export declare enum WaitlistStatus {
    WAITING = "waiting",
    PROMOTED = "promoted",
    EXPIRED = "expired",
    CANCELLED = "cancelled"
}
export interface WaitlistEntry {
    id: string;
    eventId: string;
    userId: string;
    organizationId: string;
    position: number;
    status: WaitlistStatus;
    joinedAt: Date;
    promotedAt?: Date;
    expiresAt?: Date;
    notes?: string;
    notificationSent: boolean;
}
export interface PromotionResult {
    promoted: WaitlistEntry[];
    notified: number;
    remainingWaitlist: number;
}
export interface WaitlistStats {
    totalWaiting: number;
    totalPromoted: number;
    totalExpired: number;
    totalCancelled: number;
    averageWaitTime: number;
    longestWaitTime: number;
}
export interface WaitlistConfig {
    promotionExpirationMs: number;
}
export declare class EventWaitlistService {
    private activityRepository;
    private notificationService;
    private config;
    private waitlists;
    private entryIdCounter;
    constructor(notificationService: NotificationService, config?: Partial<WaitlistConfig>);
    joinWaitlist(eventId: string, userId: string, organizationId: string, notes?: string): Promise<WaitlistEntry>;
    leaveWaitlist(eventId: string, userId: string): Promise<boolean>;
    getWaitlist(eventId: string): WaitlistEntry[];
    getWaitlistEntry(eventId: string, userId: string): WaitlistEntry | undefined;
    getWaitlistPosition(eventId: string, userId: string): number | null;
    promoteFromWaitlist(eventId: string, spotsAvailable?: number): Promise<PromotionResult>;
    confirmPromotion(eventId: string, userId: string): Promise<boolean>;
    expireUnconfirmedPromotions(eventId: string): Promise<number>;
    getWaitlistStats(eventId: string): WaitlistStats;
    getUserWaitlistEntries(userId: string): WaitlistEntry[];
    clearWaitlist(eventId: string): void;
    private recalculatePositions;
    private sendWaitlistPositionNotification;
    private sendPromotionNotification;
    notifyPositionUpdates(eventId: string): Promise<number>;
}
export declare function createEventWaitlistService(notificationService: NotificationService, config?: Partial<WaitlistConfig>): EventWaitlistService;
//# sourceMappingURL=EventWaitlistService.d.ts.map