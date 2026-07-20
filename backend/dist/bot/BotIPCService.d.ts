export interface IPCMessage {
    correlationId: string;
    traceId?: string;
    action: string;
    data: Record<string, unknown>;
    shardId?: number;
    routing?: {
        scope?: 'guild' | 'global';
        guildId?: string;
    };
    timestamp: number;
}
export interface IPCResponse {
    correlationId: string;
    traceId?: string;
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    shardId?: number;
    status?: 'handled' | 'not_handled' | 'unknown';
    definitive?: boolean;
}
export interface IPCRequestOptions {
    timeoutMs?: number;
    requireDefinitiveResponse?: boolean;
    definitiveWaitMs?: number;
    routing?: IPCMessage['routing'];
}
export type IPCHandler = (message: IPCMessage) => Promise<IPCResponse>;
export declare class BotIPCService {
    private static instance;
    private pub;
    private sub;
    private initialized;
    private readonly handlers;
    private readonly pendingRequests;
    private readonly eventListeners;
    private pubTokenRefreshHandle;
    private subTokenRefreshHandle;
    private constructor();
    static getInstance(): BotIPCService;
    initialize(): Promise<void>;
    isAvailable(): boolean;
    registerHandler(action: string, handler: IPCHandler): void;
    onEvent(event: string, callback: (data: Record<string, unknown>) => void): () => void;
    request(action: string, data?: Record<string, unknown>, optionsOrTimeout?: IPCRequestOptions | number): Promise<IPCResponse | null>;
    emit(event: string, data?: Record<string, unknown>): Promise<void>;
    private sendResponse;
    private handleMessage;
    private handleCommand;
    private handleEvent;
    private handleResponse;
    shutdown(): Promise<void>;
    static resetInstance(): void;
    private resolveRequestOptions;
    private normalizeHandlerResponse;
    private isDefinitiveResponse;
    private resolvePendingRequest;
    private publishCommandWithRetry;
    private shouldRetryPublishError;
    private toPublishErrorMessage;
}
//# sourceMappingURL=BotIPCService.d.ts.map