export interface UserPreferences {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    timezone?: string;
    notifications?: {
        email?: boolean;
        push?: boolean;
        discord?: boolean;
        digest?: boolean;
    };
    privacy?: {
        profileVisibility?: 'public' | 'organization' | 'private';
        showEmail?: boolean;
        showDiscord?: boolean;
        showBio?: boolean;
        showRsiInfo?: boolean;
        showVerifiedBadge?: boolean;
        showOrganizations?: boolean;
        showPublicShips?: boolean;
        showScStats?: boolean;
        showActivity?: boolean;
    };
    display?: {
        dateFormat?: string;
        timeFormat?: '12h' | '24h';
        currency?: string;
    };
}
export interface ShipCustomization {
    paintScheme?: string;
    decals?: string[];
    interior?: string;
    lighting?: string;
    nameplate?: string;
    [key: string]: unknown;
}
export interface ParticipantMetadata {
    joinedFrom?: string;
    invitedBy?: string;
    specialRole?: string;
    equipment?: string[];
    preferences?: {
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
export interface ActivityMetadata {
    source?: string;
    importedFrom?: string;
    externalId?: string;
    tags?: string[];
    customFields?: {
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
export type TemplateFieldDefaultValue = string | number | boolean | string[] | null;
export interface IntegrationConfig {
    apiKey?: string;
    webhookUrl?: string;
    enabled?: boolean;
    settings?: {
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
export interface ShipLoadoutComponents {
    weapons?: Array<{
        slot: string;
        item: string;
        size?: number;
    }>;
    shields?: Array<{
        slot: string;
        item: string;
    }>;
    powerPlant?: {
        item: string;
        size?: number;
    };
    coolers?: Array<{
        slot: string;
        item: string;
    }>;
    quantum?: {
        drive: string;
        fuel?: string;
    };
    [key: string]: unknown;
}
export interface BriefingData {
    objectives?: string[];
    threats?: string[];
    resources?: string[];
    intel?: string[];
    notes?: string;
    [key: string]: unknown;
}
export interface DeletionRequestData {
    reason?: string;
    requestedBy?: string;
    requestedAt?: string;
    approvals?: Array<{
        userId: string;
        timestamp: string;
    }>;
    [key: string]: unknown;
}
export interface ModelSummary {
    id: string;
    [key: string]: unknown;
}
export interface AttendanceConfirmationSummary extends ModelSummary {
    userId: string;
    eventId: string;
    status: string;
    confirmedAt?: string;
    rsvpStatus?: string;
    rsvpRole?: string;
    actualRole?: string;
    attendanceScore?: number;
    excusedAbsence?: boolean;
    confirmedBy?: string;
    durationMinutes?: number;
}
export interface OrganizationRelationshipSummary extends ModelSummary {
    orgId1: string;
    orgId2: string;
    relationship: string;
    status: string;
    allianceType?: string;
    type?: string;
    trustScore?: number;
    trustLevel?: string;
    relationshipStrength?: number;
    strengthLevel?: string;
    healthScore?: number;
    tier?: string | number;
    interactionCount?: number;
    positiveRatio?: number | string;
    lastInteraction?: Date | string;
    needsReview?: boolean;
    isExpired?: boolean;
    isMutual?: boolean;
}
export interface RelationObject {
    id: string;
    orgId1: string;
    orgId2: string;
    status: 'active' | 'proposed' | 'suspended';
    relationship: 'allied' | 'neutral' | 'hostile';
    allianceType?: string;
    [key: string]: unknown;
}
export interface DiplomaticIncident {
    id: string;
    description: string;
    resolved: boolean;
    createdAt?: Date | string;
    resolvedAt?: Date | string;
    severity?: string;
    [key: string]: unknown;
}
export interface TicketMessage {
    id: string;
    authorName: string;
    content: string;
    createdAt: Date | string;
    isInternal: boolean;
    [key: string]: unknown;
}
export interface OrgRelationship {
    id: string;
    targetOrgId: string;
    relationship: 'allied' | 'neutral' | 'hostile';
    [key: string]: unknown;
}
//# sourceMappingURL=models.d.ts.map