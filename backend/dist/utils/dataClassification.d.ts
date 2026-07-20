export declare enum DataClassification {
    PUBLIC = "PUBLIC",
    INTERNAL = "INTERNAL",
    CONFIDENTIAL = "CONFIDENTIAL",
    RESTRICTED = "RESTRICTED"
}
export interface ClassifiedFieldInfo {
    entity: string;
    field: string;
    classification: DataClassification;
    maskInLogs: boolean;
    requiresEncryption: boolean;
    reason?: string;
}
declare class DataClassificationRegistry {
    private fields;
    register(info: ClassifiedFieldInfo): void;
    getAll(): ReadonlyArray<ClassifiedFieldInfo>;
    getForEntity(entityName: string): ClassifiedFieldInfo[];
    getAtLevel(minLevel: DataClassification): ClassifiedFieldInfo[];
    getLogMaskedFields(): ClassifiedFieldInfo[];
    getEncryptionRequired(): ClassifiedFieldInfo[];
    isAtLeast(entityName: string, fieldName: string, level: DataClassification): boolean;
    getSummary(): Record<string, Record<DataClassification, string[]>>;
}
export declare const dataClassificationRegistry: DataClassificationRegistry;
interface ClassifiedOptions {
    maskInLogs?: boolean;
    requiresEncryption?: boolean;
    reason?: string;
}
export declare function Classified(classification: DataClassification, options?: ClassifiedOptions): PropertyDecorator;
export declare function maskSensitiveFields(entityName: string, data: Record<string, unknown>): Record<string, unknown>;
export {};
//# sourceMappingURL=dataClassification.d.ts.map