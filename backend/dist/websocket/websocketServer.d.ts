import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
type AdapterAttachMode = 'redis' | 'in-memory';
interface WebSocketEmitOptions {
    batchPayload?: boolean;
}
export interface WebSocketTransportReadiness {
    mode: AdapterAttachMode | 'unknown';
    reason: string;
    latencyMs: number | null;
    attachAttempted: boolean;
    timedOut: boolean;
    waitedMs: number;
}
export declare const initializeWebSocketServer: (httpServer: HttpServer) => Server;
export declare const getIO: () => Server;
export declare const awaitWebSocketTransportReady: (configuredTimeoutMs?: number) => Promise<WebSocketTransportReadiness>;
export declare const getWebSocketTransportReadinessSnapshot: () => WebSocketTransportReadiness | null;
export declare const emitToUser: (userId: string, event: string, data: unknown) => void;
export declare const emitToOrganization: (organizationId: string, event: string, data: unknown, options?: WebSocketEmitOptions) => void;
export declare const emitToRoom: (room: string, event: string, data: unknown, options?: WebSocketEmitOptions) => void;
export declare const broadcastEvent: (event: string, data: unknown) => void;
export declare const getConnectedSockets: () => Promise<number>;
export declare const getSocketsInRoom: (room: string) => Promise<number>;
export declare const closeWebSocketServer: () => Promise<void>;
export {};
//# sourceMappingURL=websocketServer.d.ts.map