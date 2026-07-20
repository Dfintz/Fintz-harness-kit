import { ExternalIntegration } from '../../../models/ExternalIntegration';
import { StarCommsClientFactory } from './StarCommsClientFactory';
import { StarCommsConnectionConfig, StarCommsMetricsSnapshot, StarCommsMetricsWindowRequest, StarCommsOperationResult, StarCommsStatusSnapshot } from './StarCommsTypes';
export declare class StarCommsAdapter {
    private readonly clientFactory;
    constructor(clientFactory?: StarCommsClientFactory);
    buildConnectionConfig(integration: ExternalIntegration): StarCommsConnectionConfig;
    getShardStatus(config: StarCommsConnectionConfig): Promise<StarCommsStatusSnapshot>;
    getMetricsWindow(config: StarCommsConnectionConfig, window: StarCommsMetricsWindowRequest): Promise<StarCommsMetricsSnapshot>;
    ensureOperationFromActivity(config: StarCommsConnectionConfig, payload: Record<string, unknown>): Promise<StarCommsOperationResult>;
    syncAssignments(config: StarCommsConnectionConfig, payload: Record<string, unknown>): Promise<StarCommsOperationResult>;
    private normalizeStatus;
    private readString;
    private readNumber;
}
//# sourceMappingURL=StarCommsAdapter.d.ts.map