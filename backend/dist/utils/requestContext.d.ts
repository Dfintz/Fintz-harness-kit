import { AsyncLocalStorage } from 'async_hooks';
export interface RequestContext {
    requestId: string;
    correlationId: string;
    userId?: string;
    username?: string;
    startTime: number;
}
export declare const requestContextStorage: AsyncLocalStorage<RequestContext>;
export declare function getRequestContext(): RequestContext | undefined;
export declare function getCorrelationMeta(): Record<string, string>;
//# sourceMappingURL=requestContext.d.ts.map