import { AssignmentStatus, CrewAssignment } from '../../models/CrewAssignment';
import { type PaginatedResponse, type PaginationOptions } from '../../utils/pagination';
export interface CreateAssignmentInput {
    shipId: string;
    missionId?: string;
    crew?: Array<{
        userId: string;
        role: string;
        station?: string;
    }>;
    startDate?: string;
    endDate?: string;
    notes?: string;
}
export interface AddCrewMemberInput {
    userId: string;
    role: string;
    station?: string;
}
export declare class CrewAssignmentService {
    private readonly repository;
    createAssignment(organizationId: string, assignerId: string, input: CreateAssignmentInput): Promise<CrewAssignment>;
    getAssignments(organizationId: string, pagination: PaginationOptions): Promise<PaginatedResponse<CrewAssignment>>;
    getAssignmentById(organizationId: string, assignmentId: string): Promise<CrewAssignment>;
    addCrewMember(organizationId: string, assignmentId: string, input: AddCrewMemberInput): Promise<CrewAssignment>;
    removeCrewMember(organizationId: string, assignmentId: string, userId: string): Promise<CrewAssignment>;
    updateStatus(organizationId: string, assignmentId: string, newStatus: AssignmentStatus): Promise<CrewAssignment>;
    getAssignmentsForShip(organizationId: string, shipId: string): Promise<CrewAssignment[]>;
    isUserAssigned(organizationId: string, userId: string): Promise<boolean>;
    getAssignmentsForUser(organizationId: string, userId: string): Promise<CrewAssignment[]>;
}
//# sourceMappingURL=CrewAssignmentService.d.ts.map