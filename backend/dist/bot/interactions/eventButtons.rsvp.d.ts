import { ParticipantRole } from '../../models/Activity';
type RSVPStatus = 'accepted' | 'declined' | 'standby';
export declare const RSVP_ACTIONS: Record<string, {
    status: RSVPStatus;
    role: ParticipantRole;
    postStatus?: RSVPStatus;
}>;
export declare function handleRSVPAction(activityId: string, userId: string, userName: string, action: string, metadata?: Record<string, unknown>): Promise<void>;
export {};
//# sourceMappingURL=eventButtons.rsvp.d.ts.map