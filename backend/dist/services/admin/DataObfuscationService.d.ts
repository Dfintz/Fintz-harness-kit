export declare enum ObfuscationLevel {
    NONE = "none",
    PARTIAL = "partial",
    FULL = "full",
    HASHED = "hashed",
    ENCRYPTED = "encrypted"
}
interface ObfuscationConfig {
    [key: string]: ObfuscationLevel;
}
export declare class DataObfuscationService {
    static encrypt(text: string): string;
    static decrypt(encryptedText: string): string;
    static hash(value: string): string;
    static partialMask(value: string, type?: 'email' | 'username' | 'generic'): string;
    static obfuscateField(fieldName: string, value: unknown, config?: ObfuscationConfig): unknown;
    static obfuscateObject<T extends Record<string, unknown>>(obj: T, config?: ObfuscationConfig): T;
    static obfuscateArray<T extends Record<string, unknown>>(items: T[], config?: ObfuscationConfig): T[];
    static createSummary(data: unknown): {
        type: string;
        size: number;
        hash: string;
        preview: string;
    };
    static obfuscateMetrics(metrics: Record<string, unknown>): Record<string, unknown>;
}
export {};
//# sourceMappingURL=DataObfuscationService.d.ts.map