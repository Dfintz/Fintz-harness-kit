import { EntityManager } from 'typeorm';
export interface AssignRoleParams {
    organizationId: string;
    targetUserId: string;
    roleId: string;
    actorUserId: string;
}
export interface RoleAssignmentResult {
    targetUserId: string;
    roleId: string;
    roleName: string;
    previousRoleName: string;
}
export declare class MemberRoleAssignmentService {
    private readonly permissionChangeEventService;
    applyRoleAssignment(manager: EntityManager, params: AssignRoleParams): Promise<RoleAssignmentResult>;
    emitRoleChanged(organizationId: string, targetUserId: string, actorUserId: string): Promise<void>;
    assignRole(params: AssignRoleParams): Promise<RoleAssignmentResult>;
}
//# sourceMappingURL=MemberRoleAssignmentService.d.ts.map