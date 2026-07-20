import { Organization } from './Organization';
export declare enum CrewRole {
    CAPTAIN = "captain",
    PILOT = "pilot",
    ENGINEER = "engineer",
    GUNNER = "gunner",
    MEDIC = "medic",
    CARGO = "cargo",
    NAVIGATOR = "navigator"
}
export declare enum AssignmentStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    COMPLETED = "completed"
}
export interface CrewMember {
    userId: string;
    role: CrewRole | string;
    assignedAt: Date;
    station?: string;
}
export declare class CrewAssignment {
    id: string;
    organizationId: string;
    organization?: Organization;
    shipId: string;
    missionId?: string;
    assignerId: string;
    crew: CrewMember[];
    startDate?: Date;
    endDate?: Date;
    status: AssignmentStatus;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=CrewAssignment.d.ts.map