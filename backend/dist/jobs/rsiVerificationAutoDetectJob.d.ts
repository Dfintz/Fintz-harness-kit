export interface RsiVerificationAutoDetectRunResult {
    outcome: 'executed' | 'skipped';
    reason?: string;
    usersChecked?: number;
    usersVerified?: number;
    organizationsChecked?: number;
    organizationsVerified?: number;
}
export declare const runRsiVerificationAutoDetectOnce: () => Promise<RsiVerificationAutoDetectRunResult>;
export declare const startRsiVerificationAutoDetectJob: () => void;
//# sourceMappingURL=rsiVerificationAutoDetectJob.d.ts.map