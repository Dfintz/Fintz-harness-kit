import { Fleet, FleetType } from '../../models/Fleet';
export interface FleetTemplate {
    id: string;
    name: string;
    description: string;
    type: FleetType;
    settings: {
        maxCapacity?: number;
        minimumSecurityLevel?: number;
        isPrivate?: boolean;
        allowAutoJoin?: boolean;
    };
    defaultRoles?: string[];
    suggestedShipTypes?: string[];
    category: 'combat' | 'mining' | 'trading' | 'exploration' | 'rescue' | 'general';
    icon?: string;
}
export declare class FleetTemplateService {
    private static instance;
    private fleetRepository;
    private fleetService;
    private constructor();
    static getInstance(): FleetTemplateService;
    getTemplates(): FleetTemplate[];
    getTemplatesByCategory(category: FleetTemplate['category']): FleetTemplate[];
    getTemplate(templateId: string): FleetTemplate | undefined;
    createFleetFromTemplate(templateId: string, organizationId: string, createdBy: string, overrides?: {
        name?: string;
        description?: string;
        settings?: Partial<FleetTemplate['settings']>;
    }): Promise<Fleet>;
    recommendTemplates(needs: {
        primaryActivity?: 'combat' | 'mining' | 'trading' | 'exploration' | 'general';
        expectedSize?: 'small' | 'medium' | 'large';
        securityLevel?: 'low' | 'medium' | 'high';
    }): FleetTemplate[];
}
//# sourceMappingURL=FleetTemplateService.d.ts.map