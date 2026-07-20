import { SecretProperties } from '@azure/keyvault-secrets';
export declare class KeyVaultService {
    private readonly secretClient;
    private readonly keyVaultName;
    private readonly isEnabled;
    private readonly secretCache;
    private readonly cacheTTL;
    private readonly operationTimeoutMs;
    private createTimeoutSignal;
    constructor();
    private cleanupInterval?;
    private startCacheCleanup;
    stopCleanup(): void;
    isConfigured(): boolean;
    getSecret(secretName: string, envVarName?: string, userId?: string): Promise<string | null>;
    getSecrets(secrets: Array<{
        secretName: string;
        envVarName?: string;
    }>): Promise<Record<string, string | null>>;
    setSecret(secretName: string, secretValue: string): Promise<boolean>;
    deleteSecret(secretName: string, userId?: string): Promise<boolean>;
    rotateSecret(secretName: string, newValue: string, userId?: string): Promise<boolean>;
    getSecretProperties(secretName: string): Promise<SecretProperties | null>;
    listSecretNames(): Promise<string[]>;
    clearCache(): void;
    needsRotation(secretName: string, maxAgeInDays?: number): Promise<boolean>;
}
//# sourceMappingURL=KeyVaultService.d.ts.map