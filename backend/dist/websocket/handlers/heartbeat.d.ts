import { Socket } from 'socket.io';
export interface HeartbeatConfig {
    intervalMs: number;
    timeoutMs: number;
    maxMissedPongs: number;
}
export declare const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig;
interface HeartbeatState {
    lastPingSent?: Date;
    lastPongReceived?: Date;
    missedPongs: number;
    isActive: boolean;
    timeoutHandle?: NodeJS.Timeout;
    intervalHandle?: NodeJS.Timeout;
}
export declare function attachHeartbeat(socket: Socket, config?: Partial<HeartbeatConfig>): HeartbeatState;
export declare function detachHeartbeat(socket: Socket, state: HeartbeatState): void;
export declare function getHeartbeatStats(state: HeartbeatState): {
    isActive: boolean;
    lastPingSent?: string;
    lastPongReceived?: string;
    missedPongs: number;
    estimatedLatencyMs?: number;
};
export {};
//# sourceMappingURL=heartbeat.d.ts.map