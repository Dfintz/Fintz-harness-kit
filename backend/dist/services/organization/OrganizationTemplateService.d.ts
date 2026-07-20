import { Organization } from '../../models/Organization';
import { OrganizationTemplate, TemplateCategory, TemplateStructure, TemplateVisibility } from '../../models/OrganizationTemplate';
export declare class OrganizationTemplateService {
    private templateRepository;
    private organizationRepository;
    private membershipRepository;
    private permissionRepository;
    constructor();
    createTemplate(data: {
        name: string;
        description: string;
        category: TemplateCategory;
        visibility: TemplateVisibility;
        structure: TemplateStructure;
        defaultSettings?: Record<string, unknown>;
        applicationConfig?: {
            allowApplications: boolean;
            requireApproval: boolean;
            autoAssignRole?: string;
            welcomeMessage?: string;
        };
        tags?: string[];
    }, creatorId: string): Promise<OrganizationTemplate>;
    applyTemplate(templateId: string, options: {
        organizationId?: string;
        organizationName?: string;
        organizationDescription?: string;
        ownerId: string;
        customizations?: {
            skipNodes?: string[];
            overrides?: Record<string, unknown>;
        };
    }): Promise<Organization>;
    private applyCustomizations;
    private createDefaultRolesAndPermissions;
    getTemplatesByCategory(category: TemplateCategory, visibility?: TemplateVisibility): Promise<OrganizationTemplate[]>;
    searchMarketplace(query: {
        search?: string;
        category?: TemplateCategory;
        tags?: string[];
        minRating?: number;
        sortBy?: 'usage' | 'rating' | 'recent' | 'name';
        sortOrder?: 'ASC' | 'DESC';
        limit?: number;
        offset?: number;
    }): Promise<{
        templates: OrganizationTemplate[];
        total: number;
    }>;
    forkTemplate(templateId: string, userId: string, customizations?: {
        name?: string;
        description?: string;
        visibility?: TemplateVisibility;
        structure?: TemplateStructure;
    }): Promise<OrganizationTemplate>;
    rateTemplate(templateId: string, userId: string, rating: number): Promise<OrganizationTemplate>;
    updateTemplate(templateId: string, userId: string, updates: {
        name?: string;
        description?: string;
        structure?: TemplateStructure;
        defaultSettings?: Record<string, unknown>;
        applicationConfig?: Record<string, unknown>;
        tags?: string[];
        visibility?: TemplateVisibility;
    }): Promise<OrganizationTemplate>;
    deleteTemplate(templateId: string, userId: string): Promise<void>;
    getTemplateById(templateId: string): Promise<OrganizationTemplate | null>;
    getTemplatesByUser(userId: string): Promise<OrganizationTemplate[]>;
    getPopularTemplates(limit?: number): Promise<OrganizationTemplate[]>;
    getTopRatedTemplates(limit?: number): Promise<OrganizationTemplate[]>;
    getRecentlyUsedTemplates(limit?: number): Promise<OrganizationTemplate[]>;
    exportTemplate(templateId: string): Promise<unknown>;
    importTemplate(data: Record<string, unknown>, userId: string): Promise<OrganizationTemplate>;
}
//# sourceMappingURL=OrganizationTemplateService.d.ts.map