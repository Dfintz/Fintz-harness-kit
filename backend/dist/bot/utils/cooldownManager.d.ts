export declare class CooldownManager {
    private static instance;
    private cooldowns;
    private constructor();
    static getInstance(): CooldownManager;
    checkCooldown(commandName: string, userId: string, cooldownSeconds: number): number;
    setCooldown(commandName: string, userId: string): void;
    clearCooldown(commandName: string, userId: string): void;
    clearUserCooldowns(userId: string): void;
    clearCommandCooldowns(commandName: string): void;
    getUserCooldowns(userId: string): Array<{
        command: string;
        remaining: number;
    }>;
    cleanupExpired(): void;
    getStats(): {
        totalCommands: number;
        totalActiveCooldowns: number;
        byCommand: Array<{
            command: string;
            active: number;
        }>;
    };
}
//# sourceMappingURL=cooldownManager.d.ts.map