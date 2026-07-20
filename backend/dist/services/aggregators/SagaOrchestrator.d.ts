import { EventEmitter } from 'events';
export interface StepResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: Error;
}
export interface SagaStep<TContext = unknown, TResult = unknown> {
    name: string;
    execute: (context: TContext) => Promise<TResult>;
    compensate: (context: TContext, result?: TResult) => Promise<void>;
    retryCount?: number;
    retryDelayMs?: number;
}
export interface SagaResult<T = unknown> {
    success: boolean;
    completed: string[];
    failed?: string;
    compensated?: string[];
    data?: T;
    error?: Error;
}
export interface SagaState {
    sagaId: string;
    name: string;
    status: 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';
    currentStep: number;
    steps: Array<{
        name: string;
        status: 'pending' | 'running' | 'completed' | 'failed' | 'compensated';
        result?: unknown;
        error?: string;
        startedAt?: Date;
        completedAt?: Date;
    }>;
    startedAt: Date;
    completedAt?: Date;
}
export interface SagaOptions {
    name: string;
    maxRetries?: number;
    retryDelayMs?: number;
    timeout?: number;
}
export declare class SagaOrchestrator<TContext = Record<string, unknown>> extends EventEmitter {
    private readonly steps;
    private readonly options;
    private state;
    private readonly stepResults;
    constructor(options: SagaOptions);
    private initializeState;
    private generateSagaId;
    addStep<TResult = unknown>(step: SagaStep<TContext, TResult>): this;
    getStepResult<T = unknown>(stepName: string): T | undefined;
    getAllStepResults(): Record<string, unknown>;
    getState(): SagaState;
    execute(context: TContext): Promise<SagaResult<Record<string, unknown>>>;
    private executeStepWithRetry;
    private compensate;
    private delay;
    reset(): void;
}
export declare function createSaga<TContext = Record<string, unknown>>(options: SagaOptions): SagaOrchestrator<TContext>;
//# sourceMappingURL=SagaOrchestrator.d.ts.map