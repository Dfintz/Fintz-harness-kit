export type BriefingTemplateCategory = 'combat' | 'mining' | 'trading' | 'exploration' | 'rescue' | 'reconnaissance' | 'escort' | 'general';
export interface BriefingTemplateElement {
    id: string;
    type: 'text' | 'shape' | 'line' | 'arrow' | 'marker';
    position: {
        x: number;
        y: number;
    };
    data: {
        content?: string;
        color?: string;
        size?: number;
        font?: string;
        shapeType?: string;
        width?: number;
        height?: number;
        rotation?: number;
    };
}
export interface BriefingTemplateSection {
    name: string;
    description: string;
    placeholder?: string;
    required: boolean;
}
export interface BriefingTemplate {
    id: string;
    name: string;
    description: string;
    category: BriefingTemplateCategory;
    icon: string;
    sections: BriefingTemplateSection[];
    elements: BriefingTemplateElement[];
    backgroundImage?: string;
    tags: string[];
    suggestedParticipantRoles?: string[];
    estimatedDuration?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    organizationId?: string;
    creatorId?: string;
}
export interface CreateFromTemplateOptions {
    templateId: string;
    creatorId: string;
    title: string;
    missionId?: string;
    customElements?: BriefingTemplateElement[];
    customTags?: string[];
    participants?: string[];
}
export interface BriefingFromTemplate {
    id: string;
    title: string;
    creatorId: string;
    missionId?: string;
    elements: BriefingTemplateElement[];
    status: string;
    participants: string[];
    version: number;
    tags: string[];
    templateId: string;
    templateName: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class BriefingTemplateService {
    private static instance;
    private constructor();
    static getInstance(): BriefingTemplateService;
    getTemplates(): BriefingTemplate[];
    getBuiltInTemplates(): BriefingTemplate[];
    private validateOrganizationId;
    private validateNotBuiltIn;
    getCustomTemplates(organizationId: string): BriefingTemplate[];
    getTemplatesByCategory(category: BriefingTemplateCategory): BriefingTemplate[];
    getTemplatesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): BriefingTemplate[];
    getTemplate(templateId: string): BriefingTemplate | undefined;
    searchTemplates(query: string): BriefingTemplate[];
    createFromTemplate(options: CreateFromTemplateOptions): BriefingFromTemplate;
    createCustomTemplate(creatorId: string, template: Omit<BriefingTemplate, 'id'>, organizationId: string): BriefingTemplate;
    updateCustomTemplate(templateId: string, updates: Partial<Omit<BriefingTemplate, 'id'>>, organizationId: string): BriefingTemplate;
    deleteCustomTemplate(templateId: string, organizationId: string): boolean;
    cloneTemplate(sourceTemplateId: string, creatorId: string, organizationId: string, newName?: string): BriefingTemplate;
    recommendTemplates(needs: {
        missionType?: BriefingTemplateCategory;
        participantCount?: number;
        difficulty?: 'beginner' | 'intermediate' | 'advanced';
        tags?: string[];
    }): BriefingTemplate[];
    getCategories(): {
        category: BriefingTemplateCategory;
        count: number;
        icon: string;
    }[];
    getStats(): {
        totalTemplates: number;
        builtInTemplates: number;
        customTemplates: number;
        categoryCounts: Record<BriefingTemplateCategory, number>;
        difficultyCounts: Record<string, number>;
    };
    clearCustomTemplates(): void;
}
//# sourceMappingURL=BriefingTemplateService.d.ts.map