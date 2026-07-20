import { TicketCategory, TicketPriority } from '../../../models/Ticket';
export interface TicketTemplateField {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'date';
    placeholder?: string;
    required: boolean;
    options?: string[];
    defaultValue?: string;
}
export interface TicketTemplate {
    id: string;
    name: string;
    description: string;
    category: TicketCategory;
    defaultPriority: TicketPriority;
    icon: string;
    subjectTemplate: string;
    descriptionTemplate: string;
    fields: TicketTemplateField[];
    tags: string[];
    suggestedAssigneeRoles?: string[];
    estimatedResponseTime?: string;
}
export interface CreateFromTemplateOptions {
    templateId: string;
    creatorId: string;
    creatorName: string;
    creatorDiscordId?: string;
    creatorEmail?: string;
    fieldValues: Record<string, string>;
    overridePriority?: TicketPriority;
    additionalTags?: string[];
}
export interface TicketFromTemplate {
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    tags: string[];
    templateId: string;
    templateName: string;
    customFields: Record<string, string>;
}
export declare class TicketTemplateService {
    private static instance;
    private constructor();
    static getInstance(): TicketTemplateService;
    getTemplates(): TicketTemplate[];
    getBuiltInTemplates(): TicketTemplate[];
    getCustomTemplates(): TicketTemplate[];
    getTemplatesByCategory(category: TicketCategory): TicketTemplate[];
    getTemplate(templateId: string): TicketTemplate | undefined;
    searchTemplates(query: string): TicketTemplate[];
    createFromTemplate(options: CreateFromTemplateOptions): TicketFromTemplate;
    createCustomTemplate(organizationId: string, template: Omit<TicketTemplate, 'id'>): TicketTemplate;
    updateCustomTemplate(templateId: string, updates: Partial<Omit<TicketTemplate, 'id'>>): TicketTemplate;
    deleteCustomTemplate(templateId: string): boolean;
    cloneTemplate(sourceTemplateId: string, organizationId: string, newName?: string): TicketTemplate;
    recommendTemplates(needs: {
        category?: TicketCategory;
        tags?: string[];
        keyword?: string;
    }): TicketTemplate[];
    getCategoryCounts(): Record<TicketCategory, number>;
    getStats(): {
        totalTemplates: number;
        builtInTemplates: number;
        customTemplates: number;
        categoryCounts: Record<TicketCategory, number>;
    };
    validateFieldValues(templateId: string, fieldValues: Record<string, string>): {
        valid: boolean;
        errors: string[];
    };
    clearCustomTemplates(): void;
}
//# sourceMappingURL=TicketTemplateService.d.ts.map