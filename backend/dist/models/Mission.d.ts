import { TenantEntity } from './base/TenantEntity';
import { Fleet } from './Fleet';
export declare enum MissionType {
    COMBAT = "combat",
    MINING = "mining",
    TRADING = "trading",
    EXPLORATION = "exploration",
    LOGISTICS = "logistics",
    RESCUE = "rescue",
    RECONNAISSANCE = "reconnaissance",
    ESCORT = "escort",
    SALVAGE = "salvage",
    CUSTOM = "custom"
}
export declare enum MissionStatus {
    DRAFT = "draft",
    PLANNED = "planned",
    BRIEFED = "briefed",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum MissionDifficulty {
    TRIVIAL = "trivial",
    EASY = "easy",
    MEDIUM = "medium",
    HARD = "hard",
    EXTREME = "extreme"
}
export declare enum MissionPriority {
    LOW = "low",
    NORMAL = "normal",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface MissionObjectiveData {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    optional?: boolean;
    order: number;
}
export interface MissionParticipantData {
    userId: string;
    role: 'leader' | 'member' | 'support' | 'reserve';
    joinedAt: string;
    status: 'confirmed' | 'pending' | 'declined';
}
export declare class Mission extends TenantEntity {
    id: string;
    title: string;
    description?: string;
    missionType: MissionType;
    status: MissionStatus;
    difficulty: MissionDifficulty;
    priority: MissionPriority;
    createdBy: string;
    assignedTo?: string;
    fleetId?: string;
    fleet?: Fleet;
    linkedActivityId?: string;
    location?: string;
    objectives: MissionObjectiveData[];
    participants: MissionParticipantData[];
    tags?: string[];
    sourceReference?: string;
    reward?: string;
    startDate?: Date;
    endDate?: Date;
    completedAt?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    isActive(): boolean;
    isTerminal(): boolean;
    static readonly STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]>;
    canTransitionTo(newStatus: MissionStatus): boolean;
}
//# sourceMappingURL=Mission.d.ts.map