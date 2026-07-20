import { Request, Response } from 'express';
import { Activity } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import type { JoinActivityDTO } from '../../services/activity/ActivityParticipantService';
type ParticipationDeps = {
    participantService: {
        joinActivity: (activityId: string, dto: JoinActivityDTO) => Promise<{
            activity: Activity;
            wasUpdate: boolean;
        }>;
        leaveActivity: (activityId: string, userId: string) => Promise<Activity>;
        getParticipants: (activityId: string) => Promise<ActivityParticipantEntity[]>;
        isLeader: (activityId: string, userId: string) => Promise<boolean>;
        isParticipant: (activityId: string, userId: string) => Promise<boolean>;
        updateParticipant: (activityId: string, userId: string, updates: Partial<Pick<ActivityParticipantEntity, 'role' | 'status' | 'shipId' | 'notes'>>) => Promise<number>;
    };
    findActivityById: (id: string, options?: {
        includeParticipants?: boolean;
    }) => Promise<Activity | null>;
    hydrateParticipants: (activity: Activity) => Promise<void>;
    notifyActivityJoined: (activity: Activity, userId: string, userName: string) => void;
};
export declare function joinActivityHandler(req: Request, res: Response, deps: Pick<ParticipationDeps, 'participantService' | 'hydrateParticipants' | 'notifyActivityJoined'>): Promise<void>;
export declare function leaveActivityHandler(req: Request, res: Response, deps: Pick<ParticipationDeps, 'participantService' | 'hydrateParticipants'>): Promise<void>;
export declare function getParticipantsHandler(req: Request, res: Response, deps: Pick<ParticipationDeps, 'participantService' | 'findActivityById'>): Promise<void>;
export declare function updateParticipantHandler(req: Request, res: Response, deps: Pick<ParticipationDeps, 'participantService' | 'findActivityById' | 'hydrateParticipants'>): Promise<void>;
export {};
//# sourceMappingURL=activityController.participation.d.ts.map