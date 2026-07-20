import { Client } from 'discord.js';
export declare class BotClientManager {
    private static instance;
    private readonly client;
    private loggedIn;
    private loginPromise;
    private constructor();
    static getInstance(): BotClientManager;
    getClient(): Client;
    login(token: string): Promise<void>;
    isReady(): boolean;
    destroy(): Promise<void>;
    static resetInstance(): void;
}
//# sourceMappingURL=BotClientManager.d.ts.map