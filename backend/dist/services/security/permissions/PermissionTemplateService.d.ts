import { PermissionAuditEntry, PermissionTemplate, PermissionTemplateItem, PermissionUsageReport, PermissionUsageStats } from '../../../types';
export declare class PermissionTemplateService {
    private permissionManager;
    private permissionRepository;
    private userOrgRepository;
    private templates;
    private auditLog;
    constructor();
    private initializeSystemTemplates;
    listTemplates(organizationId?: string): PermissionTemplate[];
    getTemplate(templateId: string): PermissionTemplate | undefined;
    createTemplate(name: string, description: string, permissions: PermissionTemplateItem[], securityLevel: number, organizationId: string, createdBy: string): PermissionTemplate;
    updateTemplate(templateId: string, updates: Partial<PermissionTemplate>): PermissionTemplate | null;
    deleteTemplate(templateId: string): boolean;
    applyTemplate(templateId: string, userId: string, organizationId: string, appliedBy: string, reason?: string): Promise<void>;
    getUserPermissionStats(userId: string, organizationId: string): Promise<PermissionUsageStats | null>;
    generateUsageReport(organizationId: string): Promise<PermissionUsageReport>;
    getAuditLog(organizationId?: string, userId?: string, startDate?: Date, endDate?: Date, limit?: number): PermissionAuditEntry[];
    logPermissionChange(eventType: PermissionAuditEntry['eventType'], userId: string, organizationId: string, performedBy: string, details: Partial<PermissionAuditEntry>): void;
    getServiceStats(): {
        totalTemplates: number;
        systemTemplates: number;
        customTemplates: number;
        auditLogEntries: number;
    };
}
//# sourceMappingURL=PermissionTemplateService.d.ts.map