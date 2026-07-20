export declare class SecretsManagerService {
    private keyVaultService;
    private static instance;
    private secrets;
    private initialized;
    private constructor();
    static getInstance(): SecretsManagerService;
    initialize(): Promise<void>;
    private loadSecrets;
    getSecret(key: string): string | null;
    getJwtSecret(): string;
    getDbPassword(): string | null;
    getDiscordBotToken(): string | null;
    getDiscordClientSecret(): string | null;
    getEncryptionKey(): string | null;
    getAzureStorageConnectionString(): string | null;
    getAzureAdClientSecret(): string | null;
    getAdminEncryptionKey(): string | null;
    rotateJwtSecret(userId: string): Promise<boolean>;
    rotateEncryptionKey(userId: string): Promise<boolean>;
    rotateDbPassword(newPassword: string, userId: string): Promise<boolean>;
    checkSecretsRotation(maxAgeInDays?: number): Promise<Record<string, boolean>>;
    reloadSecrets(): Promise<void>;
    isKeyVaultConfigured(): boolean;
    getStatus(): {
        initialized: boolean;
        keyVaultConfigured: boolean;
        secretsLoaded: number;
    };
}
//# sourceMappingURL=SecretsManagerService.d.ts.map