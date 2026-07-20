import { ActivityType, ActivityVisibility } from './Activity';
import { TenantEntity } from './base/TenantEntity';
export declare enum ActivityTemplateCategory {
    COMBAT = "combat",
    MINING = "mining",
    TRADING = "trading",
    EXPLORATION = "exploration",
    LOGISTICS = "logistics",
    SOCIAL = "social",
    TRAINING = "training",
    CUSTOM = "custom"
}
export interface ActivityTemplateData {
    description?: string;
    activityType?: ActivityType;
    visibility?: ActivityVisibility;
    maxParticipants?: number;
    minParticipants?: number;
    locationSystem?: string;
    locationPlanet?: string;
    locationDetails?: string;
    estimatedDuration?: number;
    requirements?: string[];
    objectives?: string[];
    roleRequirements?: Array<{
        role: string;
        count: number;
        required: boolean;
    }>;
    resourceRequirements?: Array<{
        resource: string;
        quantity: number;
        required: boolean;
    }>;
    requiredShips?: string[];
    preferredShips?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export declare class ActivityTemplate extends TenantEntity {
    id: string;
    name: string;
    description: string | null;
    activityType: ActivityType;
    category: ActivityTemplateCategory;
    templateData: ActivityTemplateData;
    isPublic: boolean;
    isActive: boolean;
    usageCount: number;
    tags: string[] | null;
    createdBy: string;
    createdByName: string | null;
    createdAt: Date;
    updatedAt: Date;
    incrementUsage(): void;
}
//# sourceMappingURL=ActivityTemplate.d.ts.map