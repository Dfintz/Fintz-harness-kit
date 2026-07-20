import { AuditCategory } from '../audit/AuditService';
export interface BaseDomainAuditEntry<TAction extends string> {
    action: TAction;
    organizationId: string;
    performedById?: string;
    performedByName?: string;
    timestamp: Date;
    details: Record<string, unknown>;
}
export interface DomainAuditLoggerConfig {
    category: AuditCategory;
    domainLabel: string;
    maxEntries?: number;
}
export declare abstract class DomainAuditLogger<TAction extends string, TEntry extends BaseDomainAuditEntry<TAction>> {
    private readonly buffer;
    private head;
    private count;
    private readonly maxEntries;
    protected readonly config: DomainAuditLoggerConfig;
    protected constructor(config: DomainAuditLoggerConfig);
    protected abstract buildMessage(entry: TEntry): string;
    protected abstract buildResource(entry: TEntry): string;
    log(entry: Omit<TEntry, 'timestamp'>): void;
    getAuditLog(options?: {
        organizationId?: string;
        action?: TAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        filter?: (entry: TEntry) => boolean;
    }): TEntry[];
    private pushEntry;
    private getEntries;
    protected resetBuffer(): void;
}
//# sourceMappingURL=DomainAuditLogger.d.ts.map