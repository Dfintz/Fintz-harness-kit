export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: Array<new (...args: unknown[]) => Error>;
    onRetry?: (error: Error, attempt: number) => void;
}
export declare function retryWithBackoff<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
export declare function retryWithJitter<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retryHelper.d.ts.map