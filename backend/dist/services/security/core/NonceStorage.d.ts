export declare class NonceStorage {
    isUsed(nonce: string): Promise<boolean>;
    markUsed(nonce: string, timestamp: number): Promise<void>;
    checkAndMark(nonce: string, timestamp: number): Promise<boolean>;
    getStatus(): {
        usingRedis: boolean;
        inMemoryCacheSize: number;
    };
    clear(): Promise<void>;
}
export declare function getNonceStorage(): NonceStorage;
//# sourceMappingURL=NonceStorage.d.ts.map