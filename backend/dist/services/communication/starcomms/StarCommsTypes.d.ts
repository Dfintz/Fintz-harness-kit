export interface StarCommsConnectionConfig {
    baseUrl: string;
    timeoutMs?: number;
    apiKey?: string;
    shardId?: string;
    netMappings?: Record<string, string>;
}
export interface StarCommsMetricsWindowRequest {
    startDate?: string;
    endDate?: string;
    windowMinutes?: number;
}
export interface StarCommsStatusSnapshot {
    service: string;
    status: 'healthy' | 'degraded' | 'offline' | 'unknown';
    shardId?: string;
    connectedUsers?: number;
    channels?: number;
    operationOpen?: boolean;
    updatedAt: string;
    raw: Record<string, unknown>;
}
export interface StarCommsMetricsSnapshot {
    attendanceRate?: number;
    activeParticipants?: number;
    avgSessionMinutes?: number;
    window: {
        startDate?: string;
        endDate?: string;
        windowMinutes?: number;
    };
    raw: Record<string, unknown>;
}
export interface StarCommsOperationResult {
    success: boolean;
    operationId?: string;
    message?: string;
}
export type StarCommsAssignmentAction = 'assign' | 'unassign';
export interface StarCommsAssignmentRequest {
    userId: string;
    netUid: string;
    action: StarCommsAssignmentAction;
    expiresMinutes?: number;
}
export interface StarCommsAssignmentBulkRequest {
    assignments: StarCommsAssignmentRequest[];
}
export interface StarCommsAssignmentBulkResult {
    success: boolean;
    processed: number;
    failed: number;
    message?: string;
}
export interface StarCommsOpenOperationRequest {
    open: boolean;
}
export interface StarCommsAcarsRequest {
    text: string;
    senderName?: string;
}
export interface StarCommsClient {
    getStatus(): Promise<Record<string, unknown>>;
    getMetrics(params: StarCommsMetricsWindowRequest): Promise<Record<string, unknown>>;
    openOperation(req: StarCommsOpenOperationRequest): Promise<Record<string, unknown>>;
    bulkAssign(req: StarCommsAssignmentBulkRequest): Promise<Record<string, unknown>>;
    broadcastAcars(req: StarCommsAcarsRequest): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=StarCommsTypes.d.ts.map