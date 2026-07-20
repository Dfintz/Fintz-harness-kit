export declare const SYSTEM_PERMISSIONS: {
    readonly ALL: "system:*";
    readonly SETTINGS: "system:settings";
    readonly HEALTH: "system:health";
    readonly USERS: "system:users";
    readonly AUDIT: "system:audit";
};
export declare const ORGANIZATION_PERMISSIONS: {
    readonly ALL: "org:*";
    readonly READ: "org:read";
    readonly WRITE: "org:write";
    readonly DELETE: "org:delete";
    readonly SETTINGS_READ: "org:settings:read";
    readonly SETTINGS_WRITE: "org:settings:write";
    readonly MEMBERS_READ: "org:members:read";
    readonly MEMBERS_INVITE: "org:members:invite";
    readonly MEMBERS_REMOVE: "org:members:remove";
    readonly MEMBERS_EDIT: "org:members:edit";
    readonly ROLES_READ: "org:roles:read";
    readonly ROLES_CREATE: "org:roles:create";
    readonly ROLES_EDIT: "org:roles:edit";
    readonly ROLES_DELETE: "org:roles:delete";
    readonly PERMISSIONS_READ: "org:permissions:read";
    readonly PERMISSIONS_MANAGE: "org:permissions:manage";
};
export declare const MEMBER_PERMISSIONS: {
    readonly ALL: "member:*";
    readonly READ: "member:read";
    readonly INVITE: "member:invite";
    readonly REMOVE: "member:remove";
    readonly EDIT: "member:edit";
    readonly ASSIGN_ROLE: "member:assign_role";
};
export declare const EVENT_PERMISSIONS: {
    readonly ALL: "event:*";
    readonly READ: "event:read";
    readonly CREATE: "event:create";
    readonly EDIT: "event:edit";
    readonly DELETE: "event:delete";
    readonly RSVP: "event:rsvp";
    readonly MANAGE_ATTENDEES: "event:manage_attendees";
};
export declare const FLEET_PERMISSIONS: {
    readonly ALL: "fleet:*";
    readonly READ: "fleet:read";
    readonly CREATE: "fleet:create";
    readonly EDIT: "fleet:edit";
    readonly DELETE: "fleet:delete";
    readonly MANAGE_MEMBERS: "fleet:manage_members";
    readonly MANAGE_SHIPS: "fleet:manage_ships";
};
export declare const SHIP_PERMISSIONS: {
    readonly ALL: "ship:*";
    readonly READ: "ship:read";
    readonly CREATE: "ship:create";
    readonly EDIT: "ship:edit";
    readonly DELETE: "ship:delete";
    readonly SHARE: "ship:share";
};
export declare const INTEL_PERMISSIONS: {
    readonly ALL: "intel:*";
    readonly READ: "intel:read";
    readonly CREATE: "intel:create";
    readonly EDIT: "intel:edit";
    readonly DELETE: "intel:delete";
    readonly MANAGE_CLASSIFICATION: "intel:manage_classification";
    readonly AUDIT_VIEW: "intel:audit:view";
    readonly AUDIT_CREATE: "intel:audit:create";
    readonly AUDIT_RESOLVE: "intel:audit:resolve";
    readonly WATCHLIST_VIEW: "intel:watchlist:view";
    readonly WATCHLIST_MANAGE: "intel:watchlist:manage";
};
export declare const RESOURCE_PERMISSIONS: {
    readonly ALL: "resource:*";
    readonly READ: "resource:read";
    readonly CREATE: "resource:create";
    readonly EDIT: "resource:edit";
    readonly DELETE: "resource:delete";
    readonly MANAGE: "resource:manage";
};
export declare const PROFILE_PERMISSIONS: {
    readonly READ: "profile:read";
    readonly WRITE: "profile:write";
};
export declare const SETTINGS_PERMISSIONS: {
    readonly ALL: "settings:*";
    readonly READ: "settings:read";
    readonly WRITE: "settings:write";
};
export declare const ANNOUNCEMENT_PERMISSIONS: {
    readonly ALL: "announcement:*";
    readonly READ: "announcement:read";
    readonly CREATE: "announcement:create";
    readonly EDIT: "announcement:edit";
    readonly DELETE: "announcement:delete";
};
export declare const DISCORD_PERMISSIONS: {
    readonly ALL: "discord:*";
    readonly CONFIGURE: "discord:configure";
    readonly SYNC: "discord:sync";
};
export declare const WIKI_PERMISSIONS: {
    readonly ALL: "wiki:*";
    readonly READ: "wiki:read";
    readonly CREATE: "wiki:create";
    readonly EDIT: "wiki:edit";
    readonly DELETE: "wiki:delete";
    readonly MANAGE_TREE: "wiki:manage_tree";
    readonly RESTORE_REVISION: "wiki:restore_revision";
};
export declare const RSI_PERMISSIONS: {
    readonly ALL: "rsi:*";
    readonly READ: "rsi:read";
    readonly SYNC: "rsi:sync";
    readonly VERIFY: "rsi:verify";
};
export declare const PERMISSIONS: {
    readonly SYSTEM: {
        readonly ALL: "system:*";
        readonly SETTINGS: "system:settings";
        readonly HEALTH: "system:health";
        readonly USERS: "system:users";
        readonly AUDIT: "system:audit";
    };
    readonly ORG: {
        readonly ALL: "org:*";
        readonly READ: "org:read";
        readonly WRITE: "org:write";
        readonly DELETE: "org:delete";
        readonly SETTINGS_READ: "org:settings:read";
        readonly SETTINGS_WRITE: "org:settings:write";
        readonly MEMBERS_READ: "org:members:read";
        readonly MEMBERS_INVITE: "org:members:invite";
        readonly MEMBERS_REMOVE: "org:members:remove";
        readonly MEMBERS_EDIT: "org:members:edit";
        readonly ROLES_READ: "org:roles:read";
        readonly ROLES_CREATE: "org:roles:create";
        readonly ROLES_EDIT: "org:roles:edit";
        readonly ROLES_DELETE: "org:roles:delete";
        readonly PERMISSIONS_READ: "org:permissions:read";
        readonly PERMISSIONS_MANAGE: "org:permissions:manage";
    };
    readonly MEMBER: {
        readonly ALL: "member:*";
        readonly READ: "member:read";
        readonly INVITE: "member:invite";
        readonly REMOVE: "member:remove";
        readonly EDIT: "member:edit";
        readonly ASSIGN_ROLE: "member:assign_role";
    };
    readonly EVENT: {
        readonly ALL: "event:*";
        readonly READ: "event:read";
        readonly CREATE: "event:create";
        readonly EDIT: "event:edit";
        readonly DELETE: "event:delete";
        readonly RSVP: "event:rsvp";
        readonly MANAGE_ATTENDEES: "event:manage_attendees";
    };
    readonly FLEET: {
        readonly ALL: "fleet:*";
        readonly READ: "fleet:read";
        readonly CREATE: "fleet:create";
        readonly EDIT: "fleet:edit";
        readonly DELETE: "fleet:delete";
        readonly MANAGE_MEMBERS: "fleet:manage_members";
        readonly MANAGE_SHIPS: "fleet:manage_ships";
    };
    readonly SHIP: {
        readonly ALL: "ship:*";
        readonly READ: "ship:read";
        readonly CREATE: "ship:create";
        readonly EDIT: "ship:edit";
        readonly DELETE: "ship:delete";
        readonly SHARE: "ship:share";
    };
    readonly INTEL: {
        readonly ALL: "intel:*";
        readonly READ: "intel:read";
        readonly CREATE: "intel:create";
        readonly EDIT: "intel:edit";
        readonly DELETE: "intel:delete";
        readonly MANAGE_CLASSIFICATION: "intel:manage_classification";
        readonly AUDIT_VIEW: "intel:audit:view";
        readonly AUDIT_CREATE: "intel:audit:create";
        readonly AUDIT_RESOLVE: "intel:audit:resolve";
        readonly WATCHLIST_VIEW: "intel:watchlist:view";
        readonly WATCHLIST_MANAGE: "intel:watchlist:manage";
    };
    readonly RESOURCE: {
        readonly ALL: "resource:*";
        readonly READ: "resource:read";
        readonly CREATE: "resource:create";
        readonly EDIT: "resource:edit";
        readonly DELETE: "resource:delete";
        readonly MANAGE: "resource:manage";
    };
    readonly PROFILE: {
        readonly READ: "profile:read";
        readonly WRITE: "profile:write";
    };
    readonly SETTINGS: {
        readonly ALL: "settings:*";
        readonly READ: "settings:read";
        readonly WRITE: "settings:write";
    };
    readonly ANNOUNCEMENT: {
        readonly ALL: "announcement:*";
        readonly READ: "announcement:read";
        readonly CREATE: "announcement:create";
        readonly EDIT: "announcement:edit";
        readonly DELETE: "announcement:delete";
    };
    readonly DISCORD: {
        readonly ALL: "discord:*";
        readonly CONFIGURE: "discord:configure";
        readonly SYNC: "discord:sync";
    };
    readonly RSI: {
        readonly ALL: "rsi:*";
        readonly READ: "rsi:read";
        readonly SYNC: "rsi:sync";
        readonly VERIFY: "rsi:verify";
    };
    readonly WIKI: {
        readonly ALL: "wiki:*";
        readonly READ: "wiki:read";
        readonly CREATE: "wiki:create";
        readonly EDIT: "wiki:edit";
        readonly DELETE: "wiki:delete";
        readonly MANAGE_TREE: "wiki:manage_tree";
        readonly RESTORE_REVISION: "wiki:restore_revision";
    };
};
export declare const ALL_PERMISSIONS: readonly ("org:*" | "fleet:*" | "member:*" | "intel:*" | "settings:*" | "fleet:read" | "fleet:create" | "fleet:edit" | "fleet:manage_members" | "fleet:manage_ships" | "member:read" | "intel:read" | "system:*" | "system:settings" | "system:health" | "system:users" | "system:audit" | "org:read" | "org:write" | "org:delete" | "org:settings:read" | "org:settings:write" | "org:members:read" | "org:members:invite" | "org:members:remove" | "org:members:edit" | "org:roles:read" | "org:roles:create" | "org:roles:edit" | "org:roles:delete" | "org:permissions:read" | "org:permissions:manage" | "member:invite" | "member:remove" | "member:edit" | "member:assign_role" | "event:*" | "event:read" | "event:create" | "event:edit" | "event:delete" | "event:rsvp" | "event:manage_attendees" | "fleet:delete" | "ship:*" | "ship:read" | "ship:create" | "ship:edit" | "ship:delete" | "ship:share" | "intel:create" | "intel:edit" | "intel:delete" | "intel:manage_classification" | "intel:audit:view" | "intel:audit:create" | "intel:audit:resolve" | "intel:watchlist:view" | "intel:watchlist:manage" | "resource:*" | "resource:read" | "resource:create" | "resource:edit" | "resource:delete" | "resource:manage" | "profile:read" | "profile:write" | "settings:read" | "settings:write" | "announcement:*" | "announcement:read" | "announcement:create" | "announcement:edit" | "announcement:delete" | "discord:*" | "discord:configure" | "discord:sync" | "wiki:*" | "wiki:read" | "wiki:create" | "wiki:edit" | "wiki:delete" | "wiki:manage_tree" | "wiki:restore_revision" | "rsi:*" | "rsi:read" | "rsi:sync" | "rsi:verify")[];
export declare const PERMISSION_DESCRIPTIONS: Record<string, string>;
export declare const PERMISSION_CATEGORIES: {
    readonly system: {
        readonly label: "System";
        readonly permissions: {
            readonly ALL: "system:*";
            readonly SETTINGS: "system:settings";
            readonly HEALTH: "system:health";
            readonly USERS: "system:users";
            readonly AUDIT: "system:audit";
        };
        readonly description: "System-wide administrative permissions";
    };
    readonly organization: {
        readonly label: "Organization";
        readonly permissions: {
            readonly ALL: "org:*";
            readonly READ: "org:read";
            readonly WRITE: "org:write";
            readonly DELETE: "org:delete";
            readonly SETTINGS_READ: "org:settings:read";
            readonly SETTINGS_WRITE: "org:settings:write";
            readonly MEMBERS_READ: "org:members:read";
            readonly MEMBERS_INVITE: "org:members:invite";
            readonly MEMBERS_REMOVE: "org:members:remove";
            readonly MEMBERS_EDIT: "org:members:edit";
            readonly ROLES_READ: "org:roles:read";
            readonly ROLES_CREATE: "org:roles:create";
            readonly ROLES_EDIT: "org:roles:edit";
            readonly ROLES_DELETE: "org:roles:delete";
            readonly PERMISSIONS_READ: "org:permissions:read";
            readonly PERMISSIONS_MANAGE: "org:permissions:manage";
        };
        readonly description: "Organization management permissions";
    };
    readonly members: {
        readonly label: "Members";
        readonly permissions: {
            readonly ALL: "member:*";
            readonly READ: "member:read";
            readonly INVITE: "member:invite";
            readonly REMOVE: "member:remove";
            readonly EDIT: "member:edit";
            readonly ASSIGN_ROLE: "member:assign_role";
        };
        readonly description: "Member management permissions";
    };
    readonly events: {
        readonly label: "Events";
        readonly permissions: {
            readonly ALL: "event:*";
            readonly READ: "event:read";
            readonly CREATE: "event:create";
            readonly EDIT: "event:edit";
            readonly DELETE: "event:delete";
            readonly RSVP: "event:rsvp";
            readonly MANAGE_ATTENDEES: "event:manage_attendees";
        };
        readonly description: "Event and activity permissions";
    };
    readonly fleet: {
        readonly label: "Fleet";
        readonly permissions: {
            readonly ALL: "fleet:*";
            readonly READ: "fleet:read";
            readonly CREATE: "fleet:create";
            readonly EDIT: "fleet:edit";
            readonly DELETE: "fleet:delete";
            readonly MANAGE_MEMBERS: "fleet:manage_members";
            readonly MANAGE_SHIPS: "fleet:manage_ships";
        };
        readonly description: "Fleet management permissions";
    };
    readonly ships: {
        readonly label: "Ships";
        readonly permissions: {
            readonly ALL: "ship:*";
            readonly READ: "ship:read";
            readonly CREATE: "ship:create";
            readonly EDIT: "ship:edit";
            readonly DELETE: "ship:delete";
            readonly SHARE: "ship:share";
        };
        readonly description: "Ship management permissions";
    };
    readonly intel: {
        readonly label: "Intelligence";
        readonly permissions: {
            readonly ALL: "intel:*";
            readonly READ: "intel:read";
            readonly CREATE: "intel:create";
            readonly EDIT: "intel:edit";
            readonly DELETE: "intel:delete";
            readonly MANAGE_CLASSIFICATION: "intel:manage_classification";
            readonly AUDIT_VIEW: "intel:audit:view";
            readonly AUDIT_CREATE: "intel:audit:create";
            readonly AUDIT_RESOLVE: "intel:audit:resolve";
            readonly WATCHLIST_VIEW: "intel:watchlist:view";
            readonly WATCHLIST_MANAGE: "intel:watchlist:manage";
        };
        readonly description: "Intelligence and reports permissions";
    };
    readonly resources: {
        readonly label: "Resources";
        readonly permissions: {
            readonly ALL: "resource:*";
            readonly READ: "resource:read";
            readonly CREATE: "resource:create";
            readonly EDIT: "resource:edit";
            readonly DELETE: "resource:delete";
            readonly MANAGE: "resource:manage";
        };
        readonly description: "Resource management permissions";
    };
    readonly profile: {
        readonly label: "Profile";
        readonly permissions: {
            readonly READ: "profile:read";
            readonly WRITE: "profile:write";
        };
        readonly description: "User profile permissions";
    };
    readonly settings: {
        readonly label: "Settings";
        readonly permissions: {
            readonly ALL: "settings:*";
            readonly READ: "settings:read";
            readonly WRITE: "settings:write";
        };
        readonly description: "Settings management permissions";
    };
    readonly announcements: {
        readonly label: "Announcements";
        readonly permissions: {
            readonly ALL: "announcement:*";
            readonly READ: "announcement:read";
            readonly CREATE: "announcement:create";
            readonly EDIT: "announcement:edit";
            readonly DELETE: "announcement:delete";
        };
        readonly description: "Announcement permissions";
    };
    readonly wiki: {
        readonly label: "Wiki";
        readonly permissions: {
            readonly ALL: "wiki:*";
            readonly READ: "wiki:read";
            readonly CREATE: "wiki:create";
            readonly EDIT: "wiki:edit";
            readonly DELETE: "wiki:delete";
            readonly MANAGE_TREE: "wiki:manage_tree";
            readonly RESTORE_REVISION: "wiki:restore_revision";
        };
        readonly description: "Wiki page management permissions";
    };
    readonly integrations: {
        readonly label: "Integrations";
        readonly permissions: {
            readonly ALL: "rsi:*";
            readonly READ: "rsi:read";
            readonly SYNC: "rsi:sync";
            readonly VERIFY: "rsi:verify";
            readonly CONFIGURE: "discord:configure";
        };
        readonly description: "Third-party integration permissions";
    };
};
export declare function isValidPermission(permission: string): boolean;
export declare function getPermissionDescription(permission: string): string;
export type PermissionString = (typeof ALL_PERMISSIONS)[number];
export type PermissionCategory = keyof typeof PERMISSION_CATEGORIES;
//# sourceMappingURL=permissions.d.ts.map