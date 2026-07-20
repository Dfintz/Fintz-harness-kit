import { TreatyClause, TreatyTemplate, TreatyTemplateCategory, TreatyTemplateScope } from '../../models/TreatyTemplate';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export declare class TreatyTemplateService {
    private readonly repository;
    getTemplates(organizationId: string, filters?: {
        category?: TreatyTemplateCategory;
        scope?: TreatyTemplateScope;
        search?: string;
    }, pagination?: PaginationOptions): Promise<PaginatedResponse<TreatyTemplate>>;
    getTemplateById(organizationId: string, templateId: string): Promise<TreatyTemplate>;
    createTemplate(organizationId: string, data: {
        name: string;
        description: string;
        category: TreatyTemplateCategory;
        scope: TreatyTemplateScope;
        clauses: Array<Omit<TreatyClause, 'id'>>;
        isPublished?: boolean;
        tags?: string[];
    }): Promise<TreatyTemplate>;
    updateTemplate(organizationId: string, templateId: string, data: {
        name?: string;
        description?: string;
        category?: TreatyTemplateCategory;
        scope?: TreatyTemplateScope;
        clauses?: Array<Omit<TreatyClause, 'id'>>;
        isPublished?: boolean;
        tags?: string[];
    }): Promise<TreatyTemplate>;
    deleteTemplate(organizationId: string, templateId: string): Promise<void>;
    instantiateTemplate(organizationId: string, data: {
        templateId: string;
        clauseOverrides?: Record<string, string>;
        additionalClauses?: Array<{
            title: string;
            text: string;
        }>;
        excludeClauses?: string[];
    }): Promise<Array<{
        term: string;
        description: string;
    }>>;
    getBuiltInTemplates(): Promise<TreatyTemplate[]>;
}
//# sourceMappingURL=TreatyTemplateService.d.ts.map