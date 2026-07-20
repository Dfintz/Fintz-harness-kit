import { ParticipantRole } from './Activity';
export declare enum ActivityParticipantStatus {
    INVITED = "invited",
    ACCEPTED = "accepted",
    DECLINED = "declined",
    STANDBY = "standby"
}
export declare class ActivityParticipantEntity {
    id: string;
    activityId: string;
    userId: string;
    userName: string;
    avatarUrl?: string;
    organizationId?: string;
    organizationName?: string;
    role: ParticipantRole;
    status: ActivityParticipantStatus;
    joinedAt: Date;
    shipType?: string;
    shipName?: string;
    shipId?: string;
    crewPosition?: string;
    crewShipId?: string;
    reputation?: number;
    notes?: string;
    message?: string;
    metadata?: Record<string, unknown>;
    updatedAt: Date;
    activity?: unknown;
}
//# sourceMappingURL=ActivityParticipant.d.ts.map