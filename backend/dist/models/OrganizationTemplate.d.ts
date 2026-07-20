export declare enum TemplateCategory {
    MILITARY = "MILITARY",
    CORPORATE = "CORPORATE",
    GUILD = "GUILD",
    COMMUNITY = "COMMUNITY",
    PROJECT = "PROJECT",
    CUSTOM = "CUSTOM"
}
export declare enum TemplateVisibility {
    PUBLIC = "PUBLIC",
    PRIVATE = "PRIVATE",
    ORGANIZATION = "ORGANIZATION",
    MARKETPLACE = "MARKETPLACE"
}
export interface TemplateStructure {
    name: string;
    description?: string;
    type: string;
    level: number;
    children?: TemplateStructure[];
    defaultRoles?: string[];
    defaultMemberCount?: number;
}
export interface DefaultRole {
    name: string;
    description?: string;
    permissions: string[];
    memberCount?: number;
    autoAssign?: boolean;
}
export interface DefaultPermission {
    resource: string;
    actions: string[];
    scope: string;
    inheritable: boolean;
    priority: number;
    applyToRoles?: string[];
}
export interface TemplateSettings {
    allowSubOrgs: boolean;
    maxDepth: number;
    requireApproval: boolean;
    inheritPermissions: boolean;
    autoArchiveInactive: boolean;
    inactivityThreshold?: number;
    visibility: string;
    customFields?: Array<{
        name: string;
        type: string;
        required: boolean;
        defaultValue?: unknown;
    }>;
}
export interface ApplicationConfig {
    createSubOrgsByDefault: boolean;
    subOrgDepth?: number;
    assignDefaultRoles: boolean;
    sendWelcomeMessages: boolean;
    enableAnalytics: boolean;
    customizationOptions?: Record<string, unknown>;
    allowApplications?: boolean;
    requireApproval?: boolean;
    autoAssignRole?: string;
    welcomeMessage?: string;
}
export declare class OrganizationTemplate {
    id: string;
    name: string;
    description: string | null;
    category: TemplateCategory;
    visibility: TemplateVisibility;
    createdBy: string;
    creatorName: string | null;
    structure: TemplateStructure;
    defaultRoles: DefaultRole[];
    defaultPermissions: DefaultPermission[];
    defaultSettings: TemplateSettings;
    applicationConfig: ApplicationConfig;
    tags: string[] | null;
    iconUrl: string | null;
    usageCount: number;
    averageRating: number;
    ratingCount: number;
    isActive: boolean;
    isFeatured: boolean;
    isVerified: boolean;
    isPublic: boolean;
    get creatorId(): string;
    set creatorId(value: string);
    version: string;
    changelog: string | null;
    forkedFrom: string | null;
    sourceTemplate: OrganizationTemplate | null;
    preview: {
        screenshots?: string[];
        demoUrl?: string;
        features?: string[];
        requirements?: string[];
    } | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt: Date | null;
    getMaxDepth(): number;
    getNodeCount(): number;
    getAllRoles(): string[];
    validateStructure(): {
        valid: boolean;
        errors: string[];
    };
    getSummary(): {
        id: string;
        name: string;
        description: string | null;
        category: TemplateCategory;
        visibility: TemplateVisibility;
        iconUrl: string | null;
        usageCount: number;
        averageRating: number;
        ratingCount: number;
        isFeatured: boolean;
        isVerified: boolean;
        tags: string[] | null;
        maxDepth: number;
        nodeCount: number;
        roleCount: number;
        createdAt: Date;
        updatedAt: Date;
    };
    incrementUsage(): void;
    addRating(rating: number): void;
    fork(newName: string, userId: string): Partial<OrganizationTemplate>;
    export(): object;
    canBeUsedBy(userId: string, _userOrgId?: string): boolean;
}
//# sourceMappingURL=OrganizationTemplate.d.ts.map