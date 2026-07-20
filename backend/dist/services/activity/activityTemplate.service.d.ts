import { Activity, ActivityType } from '../../models/Activity';
import { ActivityTemplate, ActivityTemplateCategory, type ActivityTemplateData } from '../../models/ActivityTemplate';
import { TenantService } from '../base/TenantService';
export interface CreateTemplateDTO {
    name: string;
    description?: string;
    activityType: ActivityType;
    category?: ActivityTemplateCategory;
    templateData?: ActivityTemplateData;
    isPublic?: boolean;
    tags?: string[];
}
export interface UpdateTemplateDTO {
    name?: string;
    description?: string;
    activityType?: ActivityType;
    category?: ActivityTemplateCategory;
    templateData?: ActivityTemplateData;
    isPublic?: boolean;
    isActive?: boolean;
    tags?: string[];
}
export interface TemplateQueryFilters {
    category?: ActivityTemplateCategory;
    activityType?: ActivityType;
    isPublic?: boolean;
    search?: string;
    page?: number;
    limit?: number;
}
export interface ApplyTemplateDTO {
    title: string;
    scheduledStartTime: string;
    estimatedDuration?: number;
    maxParticipants?: number;
    overrides?: Record<string, unknown>;
}
export declare class ActivityTemplateService extends TenantService<ActivityTemplate> {
    constructor();
    getTemplates(organizationId: string, filters?: TemplateQueryFilters): Promise<import("../../utils/pagination").PaginatedResponse<ActivityTemplate>>;
    listTemplates(organizationId: string, filters?: TemplateQueryFilters): Promise<import("../../utils/pagination").PaginatedResponse<ActivityTemplate>>;
    getTemplateById(organizationId: string, templateId: string, _userId: string): Promise<ActivityTemplate | null>;
    getTemplate(organizationId: string, templateId: string): Promise<ActivityTemplate | null>;
    createTemplate(organizationId: string, dto: CreateTemplateDTO, userId: string, userName?: string): Promise<ActivityTemplate>;
    updateTemplate(organizationId: string, templateId: string, dto: UpdateTemplateDTO, _userId: string): Promise<ActivityTemplate | null>;
    deleteTemplate(organizationId: string, templateId: string, _userId: string): Promise<boolean>;
    cloneTemplate(organizationId: string, templateId: string, userId: string, userName?: string): Promise<ActivityTemplate | null>;
    createActivityFromTemplate(organizationId: string, templateId: string, dto: ApplyTemplateDTO, userId: string, userName?: string): Promise<Activity | null>;
    getCategories(): Array<{
        value: string;
        label: string;
    }>;
}
//# sourceMappingURL=activityTemplate.service.d.ts.map