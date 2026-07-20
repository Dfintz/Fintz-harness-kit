"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HEARTBEAT_CONFIG = void 0;
exports.attachHeartbeat = attachHeartbeat;
exports.detachHeartbeat = detachHeartbeat;
exports.getHeartbeatStats = getHeartbeatStats;
const logger_1 = require("../../utils/logger");
const message_envelope_1 = require("../schemas/message-envelope");
exports.DEFAULT_HEARTBEAT_CONFIG = {
    intervalMs: 30000,
    timeoutMs: 5000,
    maxMissedPongs: 3,
};
function attachHeartbeat(socket, config = {}) {
    const finalConfig = { ...exports.DEFAULT_HEARTBEAT_CONFIG, ...config };
    const state = {
        missedPongs: 0,
        isActive: true,
    };
    socket.on('pong', (message) => {
        if (state.timeoutHandle) {
            clearTimeout(state.timeoutHandle);
            state.timeoutHandle = undefined;
        }
        state.lastPongReceived = new Date();
        state.missedPongs = 0;
        logger_1.logger.debug(`Heartbeat pong received from ${socket.id} (latency: ${new Date().getTime() - new Date(message.timestamp).getTime()}ms)`);
    });
    socket.on('ping-timeout', () => {
        state.missedPongs++;
        logger_1.logger.warn(`Heartbeat timeout for ${socket.id} (${state.missedPongs}/${finalConfig.maxMissedPongs})`);
        if (state.missedPongs >= finalConfig.maxMissedPongs) {
            logger_1.logger.error(`Max missed pongs reached for ${socket.id}, disconnecting`);
            socket.disconnect(true);
            state.isActive = false;
        }
    });
    state.intervalHandle = setInterval(() => {
        if (!state.isActive || !socket.connected) {
            return;
        }
        const heartbeat = (0, message_envelope_1.createHeartbeat)('ping');
        state.lastPingSent = new Date(heartbeat.timestamp);
        socket.emit('ping', heartbeat);
        state.timeoutHandle = setTimeout(() => {
            socket.emit('ping-timeout');
        }, finalConfig.timeoutMs);
    }, finalConfig.intervalMs);
    return state;
}
function detachHeartbeat(socket, state) {
    state.isActive = false;
    if (state.intervalHandle) {
        clearInterval(state.intervalHandle);
    }
    if (state.timeoutHandle) {
        clearTimeout(state.timeoutHandle);
    }
    socket.removeAllListeners('pong');
    socket.removeAllListeners('ping-timeout');
}
function getHeartbeatStats(state) {
    return {
        isActive: state.isActive,
        lastPingSent: state.lastPingSent?.toISOString(),
        lastPongReceived: state.lastPongReceived?.toISOString(),
        missedPongs: state.missedPongs,
        estimatedLatencyMs: state.lastPingSent && state.lastPongReceived
            ? new Date(state.lastPongReceived).getTime() - new Date(state.lastPingSent).getTime()
            : undefined,
    };
}
//# sourceMappingURL=heartbeat.js.map