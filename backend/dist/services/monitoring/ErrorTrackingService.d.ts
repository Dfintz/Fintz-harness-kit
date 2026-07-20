import { Request } from 'express';
export declare enum ErrorSeverity {
    Verbose = 0,
    Information = 1,
    Warning = 2,
    Error = 3,
    Critical = 4
}
export interface ErrorContext {
    userId?: string;
    organizationId?: string;
    route?: string;
    method?: string;
    statusCode?: number;
    requestId?: string;
    correlationId?: string;
    userAgent?: string;
    ipAddress?: string;
    requestDuration?: number;
    breadcrumbs?: unknown[];
    queryParams?: Record<string, unknown>;
    requestSize?: number;
    additionalData?: Record<string, unknown>;
}
export interface ErrorTrackingOptions {
    severity?: ErrorSeverity;
    context?: ErrorContext;
    tags?: Record<string, string>;
    metrics?: Record<string, number>;
}
export declare class ErrorTrackingService {
    private static instance;
    private isInitialized;
    private constructor();
    static getInstance(): ErrorTrackingService;
    initialize(): void;
    trackError(error: Error, options?: ErrorTrackingOptions): void;
    trackRequestError(error: Error, req: Request, options?: Partial<ErrorTrackingOptions>): void;
    trackAsyncError(error: Error | unknown, context?: ErrorContext): void;
    trackCriticalError(error: Error, context?: ErrorContext): void;
    private extractRequestContext;
    private buildContextProperties;
    private toTelemetryProperties;
    private setupGlobalErrorHandlers;
}
export declare const errorTrackingService: ErrorTrackingService;
//# sourceMappingURL=ErrorTrackingService.d.ts.map