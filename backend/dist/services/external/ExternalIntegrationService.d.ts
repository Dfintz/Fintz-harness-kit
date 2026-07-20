import { Repository } from 'typeorm';
import { CreateIntegrationDto, ExternalIntegration, SyncRequest, SyncResult, UpdateIntegrationDto } from '../../models/ExternalIntegration';
import { CreateInventoryItemDto, FleetInventory } from '../../models/FleetInventory';
export declare class ExternalIntegrationService {
    private integrationRepository;
    private inventoryRepository;
    private axiosInstances;
    constructor(integrationRepository?: Repository<ExternalIntegration>, inventoryRepository?: Repository<FleetInventory>);
    createIntegration(dto: CreateIntegrationDto): Promise<ExternalIntegration>;
    getIntegrationById(id: string): Promise<ExternalIntegration | null>;
    getIntegrations(fleetId: string): Promise<ExternalIntegration[]>;
    updateIntegration(id: string, dto: UpdateIntegrationDto): Promise<ExternalIntegration>;
    deleteIntegration(id: string): Promise<void>;
    testConnection(id: string): Promise<{
        success: boolean;
        responseTime?: number;
        error?: string;
    }>;
    syncInventory(request: SyncRequest): Promise<SyncResult>;
    processAutoSyncs(): Promise<{
        syncedCount: number;
        failedCount: number;
        results: Array<{
            integrationId: string;
            result?: SyncResult;
            error?: string;
        }>;
    }>;
    sendWebhook(integrationId: string, data: unknown): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
    private resolveExternalUrl;
    private validateUrlForSSRF;
    private validateStarCommsConfig;
    private getAxiosClient;
    private buildAxiosRequestConfig;
    private fetchExternalInventory;
    private pushInventoryToExternal;
    mapExternalToInternal(externalItem: unknown, integration: ExternalIntegration): Partial<CreateInventoryItemDto>;
    private safelyTransformValue;
    private mapInternalToExternal;
    private getNestedValue;
    private setNestedValue;
}
//# sourceMappingURL=ExternalIntegrationService.d.ts.map