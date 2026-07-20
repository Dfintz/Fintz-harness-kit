export interface WizardSessionStoreOptions<TSession> {
    ttlMs: number;
    cleanupIntervalMs: number;
    keyFactory: (...parts: string[]) => string;
    getLastInteraction: (session: TSession) => number;
    touch: (session: TSession, now: number) => void;
    now?: () => number;
}
export declare class WizardSessionStore<TSession> {
    private readonly options;
    private readonly sessions;
    private readonly cleanupHandle;
    constructor(options: WizardSessionStoreOptions<TSession>);
    makeKey(...parts: string[]): string;
    set(key: string, session: TSession): void;
    get(key: string): TSession | null;
    delete(key: string): boolean;
    size(): number;
    dispose(): void;
    private currentTime;
    private cleanupExpired;
}
//# sourceMappingURL=wizardSessionStore.d.ts.map