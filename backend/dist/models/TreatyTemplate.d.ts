export type TreatyTemplateCategory = 'mutual_defense' | 'trade' | 'non_aggression' | 'resource_sharing' | 'intel_sharing' | 'military_cooperation' | 'custom';
export type TreatyTemplateScope = 'alliance' | 'federation' | 'both';
export interface TreatyClause {
    id: string;
    title: string;
    text: string;
    isRequired: boolean;
    sortOrder: number;
}
export declare class TreatyTemplate {
    id: string;
    name: string;
    description: string;
    category: TreatyTemplateCategory;
    scope: TreatyTemplateScope;
    clauses: TreatyClause[];
    isBuiltIn: boolean;
    organizationId?: string;
    isPublished: boolean;
    version: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=TreatyTemplate.d.ts.map