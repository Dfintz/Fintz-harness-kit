export declare enum BriefingStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    COMPLETED = "completed",
    ARCHIVED = "archived"
}
export declare enum BriefingClassification {
    PUBLIC = "public",
    RESTRICTED = "restricted",
    CONFIDENTIAL = "confidential",
    SECRET = "secret",
    TOP_SECRET = "top_secret"
}
export declare class Briefing {
    id: string;
    title: string;
    creatorId: string;
    organizationId?: string;
    missionId?: string;
    classification: BriefingClassification;
    operationIds?: string[];
    elements: Array<{
        id: string;
        type: 'text' | 'shape' | 'line' | 'arrow' | 'marker' | 'image' | 'map' | 'waypoint' | 'video' | 'link' | 'file' | 'tactical-unit' | 'map-reference' | 'interdiction-point' | 'ship-map';
        position: {
            x: number;
            y: number;
        };
        data: unknown;
    }>;
    status: BriefingStatus;
    participants?: string[];
    version: number;
    backgroundImage?: string;
    pages?: Array<{
        backgroundImage?: string | null;
    }>;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Briefing.d.ts.map