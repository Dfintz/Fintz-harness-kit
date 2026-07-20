export declare enum ExternalCatalogSource {
    SCMDB = "scmdb",
    SC_CRAFT = "sc-craft"
}
export declare enum ExternalCatalogRecordType {
    CONTRACT = "contract",
    BLUEPRINT = "blueprint",
    RESOURCE = "resource"
}
export declare class ExternalCatalogRecord {
    id: string;
    source: ExternalCatalogSource;
    recordType: ExternalCatalogRecordType;
    externalId: string;
    displayName?: string;
    category?: string;
    sourceVersion?: string;
    payloadHash: string;
    payload: Record<string, unknown>;
    isActive: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
    lastSyncedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=ExternalCatalogRecord.d.ts.map