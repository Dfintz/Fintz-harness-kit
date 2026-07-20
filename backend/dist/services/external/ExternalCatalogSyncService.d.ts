import { AxiosInstance } from 'axios';
import { Repository } from 'typeorm';
import { ExternalCatalogRecord, ExternalCatalogRecordType, ExternalCatalogSource } from '../../models/ExternalCatalogRecord';
export interface ExternalCatalogSyncRequest {
    dryRun?: boolean;
    sampleSize?: number;
    sources?: ExternalCatalogSource[];
}
export interface ExternalCatalogDiffSample {
    externalId: string;
    displayName?: string;
    changedFields?: string[];
}
export interface ExternalCatalogDatasetDelta {
    source: ExternalCatalogSource;
    recordType: ExternalCatalogRecordType;
    incomingCount: number;
    existingCount: number;
    changes: {
        create: number;
        update: number;
        deactivate: number;
        unchanged: number;
    };
    samples: {
        create: ExternalCatalogDiffSample[];
        update: ExternalCatalogDiffSample[];
        deactivate: ExternalCatalogDiffSample[];
    };
    metadata?: Record<string, unknown>;
}
export interface ExternalCatalogSyncReport {
    dryRun: boolean;
    sources: ExternalCatalogSource[];
    startedAt: string;
    completedAt: string;
    durationMs: number;
    summary: {
        incoming: number;
        create: number;
        update: number;
        deactivate: number;
        unchanged: number;
    };
    datasets: ExternalCatalogDatasetDelta[];
    warnings: string[];
}
export declare class ExternalCatalogSyncService {
    private readonly repositoryOverride?;
    private readonly client;
    constructor(repository?: Repository<ExternalCatalogRecord>, client?: AxiosInstance);
    synchronize(request?: ExternalCatalogSyncRequest): Promise<ExternalCatalogSyncReport>;
    private get repository();
    private resolveSampleSize;
    private resolveSources;
    private collectDatasets;
    private fetchScmdbContracts;
    private resolveScmdbVersionInfo;
    private fetchScCraftDatasets;
    private fetchAllScCraftBlueprints;
    private fetchOptionalObject;
    private fetchOptionalArray;
    private findActiveVersion;
    private buildDatasetPlan;
    private getChangedFields;
    private diffTopLevelPayloadKeys;
    private applyPlans;
    private toIncomingRecord;
    private stableStringify;
    private toObjectArray;
    private requireObject;
    private isObject;
    private toNonEmptyString;
    private normalizeString;
    private toBoolean;
    private toPositiveInteger;
    private chunk;
}
//# sourceMappingURL=ExternalCatalogSyncService.d.ts.map