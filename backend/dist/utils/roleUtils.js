"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleName = getRoleName;
exports.getDefaultPermissionsForRole = getDefaultPermissionsForRole;
exports.getRolePriority = getRolePriority;
exports.isOwnerRole = isOwnerRole;
exports.isOwnerOrAdminRole = isOwnerOrAdminRole;
function getRoleName(role) {
    if (!role) {
        return '';
    }
    if (typeof role === 'string') {
        return role.toLowerCase();
    }
    return (role.name ?? '').toLowerCase();
}
const DEFAULT_ROLE_PERMISSIONS = {
    founder: ['*'],
    owner: ['*'],
    admin: ['org:*', 'fleet:*', 'member:*', 'activity:*', 'intel:*', 'settings:*'],
    senior_officer: [
        'fleet:read',
        'fleet:create',
        'fleet:edit',
        'fleet:manage_members',
        'fleet:manage_ships',
        'member:read',
        'activity:read',
        'activity:create',
        'activity:edit',
        'intel:read',
    ],
    fleet_commander: [
        'fleet:read',
        'fleet:create',
        'fleet:edit',
        'fleet:manage_members',
        'fleet:manage_ships',
        'member:read',
        'activity:read',
        'activity:create',
        'activity:edit',
        'intel:read',
    ],
    officer: [
        'fleet:read',
        'fleet:create',
        'member:read',
        'activity:read',
        'activity:create',
        'intel:read',
    ],
    member: ['fleet:read', 'member:read', 'activity:read', 'activity:create'],
    recruit: ['fleet:read', 'member:read', 'activity:read'],
};
function getDefaultPermissionsForRole(roleName) {
    return (DEFAULT_ROLE_PERMISSIONS[roleName.toLowerCase()] || DEFAULT_ROLE_PERMISSIONS['member'] || []);
}
function getRolePriority(roleName) {
    const priorities = {
        founder: 100,
        owner: 100,
        admin: 80,
        senior_officer: 60,
        fleet_commander: 60,
        officer: 40,
        member: 10,
        recruit: 5,
    };
    return priorities[roleName.toLowerCase()] || 0;
}
const OWNER_ROLES = new Set(['owner', 'founder']);
const ADMIN_ROLES = new Set(['owner', 'founder', 'admin']);
function isOwnerRole(role) {
    return OWNER_ROLES.has(getRoleName(role));
}
function isOwnerOrAdminRole(role) {
    return ADMIN_ROLES.has(getRoleName(role));
}
//# sourceMappingURL=roleUtils.js.map