export declare const MIRROR_RSVP_SYNC_ACTION = "mirror:rsvp:sync";
export interface MirrorSyncPayload {
    activityId: string;
    userId: string;
    action: 'join' | 'tentative' | 'decline' | 'leave' | 'refresh';
    currentParticipants: number;
    maxParticipants?: number;
}
export declare function publishMirrorSync(payload: MirrorSyncPayload): Promise<void>;
export declare function publishMirrorRefresh(activityId: string, userId?: string): void;
//# sourceMappingURL=mirrorSyncPublisher.d.ts.map