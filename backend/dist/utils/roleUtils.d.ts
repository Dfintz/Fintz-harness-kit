import type { Role } from '../models/Role';
type RoleInput = Role | string | null | undefined;
export declare function getRoleName(role: RoleInput): string;
export declare function getDefaultPermissionsForRole(roleName: string): string[];
export declare function getRolePriority(roleName: string): number;
export declare function isOwnerRole(role: RoleInput): boolean;
export declare function isOwnerOrAdminRole(role: RoleInput): boolean;
export {};
//# sourceMappingURL=roleUtils.d.ts.map