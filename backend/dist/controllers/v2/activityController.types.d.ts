import type { ActivityStatus, ParticipantRole } from '../../models/Activity';
export interface CreateActivityBody {
    organizationId?: string;
    title?: string;
    description?: string;
    type?: string;
    status?: string;
    visibility?: string;
    maxParticipants?: number;
    startDate?: string;
    endDate?: string;
    timezone?: string;
    location?: string;
    requirements?: string;
    estimatedDuration?: number;
    metadata?: Record<string, unknown>;
    shipRequirementType?: string;
    voiceChannelMode?: 'none' | 'current' | 'temp';
    voiceChannelLimit?: number;
    requiredShips?: ReadonlyArray<{
        requirementType: string;
        count: number;
        crewPerShip?: number;
        avgCrewPerShip?: number;
    }>;
    crewSpotsTotal?: number;
}
export interface JoinActivityBody {
    role?: ParticipantRole;
    shipId?: string;
    shipType?: string;
    shipName?: string;
    crewPosition?: string;
    crewShipId?: string;
    notes?: string;
}
export interface UpdateParticipantBody {
    role?: ParticipantRole;
    status?: 'accepted' | 'invited' | 'declined' | 'standby';
    shipId?: string;
    notes?: string;
}
export interface UpdateActivityBody {
    title?: string;
    description?: string;
    type?: string;
    status?: string;
    visibility?: string;
    maxParticipants?: number;
    startDate?: string;
    endDate?: string;
    timezone?: string;
    location?: string;
    requirements?: string;
    estimatedDuration?: number;
    metadata?: Record<string, unknown>;
    shipRequirementType?: string;
    voiceChannelMode?: 'none' | 'current' | 'temp';
    voiceChannelLimit?: number;
    requiredShips?: ReadonlyArray<{
        requirementType: string;
        count: number;
        crewPerShip?: number;
        avgCrewPerShip?: number;
    }>;
    crewSpotsTotal?: number;
}
export interface JoinByTokenBody {
    role?: ParticipantRole;
    shipId?: string;
    shipType?: string;
    shipName?: string;
    notes?: string;
}
export interface UpdateStatusBody {
    status: ActivityStatus;
    notes?: string;
}
export interface CompleteActivityBody {
    report?: string;
    attendanceCount?: number;
    notes?: string;
}
export interface CancelActivityBody {
    notes?: string;
}
export interface AddShipBody {
    shipId?: string;
    shipType?: string;
    shipName?: string;
    role?: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
    crewCapacity?: number;
    capabilities?: string[];
    parentShipId?: string;
    transportType?: string;
}
export interface LoanShipsBody {
    ships?: Array<{
        shipId?: string;
        shipType: string;
        shipName?: string;
        crewCapacity?: number;
    }>;
}
export interface InviteOrgBody {
    organizationId?: string;
    organizationName?: string;
    role?: 'co_host' | 'participant' | 'allied' | 'contracted';
}
export interface BatchCreateBody {
    activities?: Array<Record<string, unknown> & {
        status?: string;
    }>;
}
export interface BatchUpdateBody {
    updates?: Array<{
        id?: string;
        [key: string]: unknown;
    }>;
}
export interface BatchDeleteBody {
    activityIds?: string[];
}
//# sourceMappingURL=activityController.types.d.ts.map