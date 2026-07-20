interface CASSchedulerConcurrencySettings {
    poolMaxConnections: number;
    poolUtilizationRatio: number;
    requestedConcurrency: number;
    maxConcurrencyFromPool: number;
    effectiveConcurrency: number;
}
export declare function resolveCASSchedulerConcurrency(poolMaxConnectionsOverride?: number): CASSchedulerConcurrencySettings;
export declare function runCASComputationCycle(): Promise<void>;
export declare function startCASComputationJob(): void;
export declare function stopCASComputationJob(): void;
export {};
//# sourceMappingURL=casComputationJob.d.ts.map