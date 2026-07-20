"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnvelopeValidator = createEnvelopeValidator;
exports.attachValidationStats = attachValidationStats;
exports.withStrictValidation = withStrictValidation;
const logger_1 = require("../../utils/logger");
const message_envelope_1 = require("../schemas/message-envelope");
const eventValidators = new Map([
    ['ping', message_envelope_1.heartbeatSchema],
    ['pong', message_envelope_1.heartbeatSchema],
    ['negotiate', message_envelope_1.negotiationSchema],
]);
function createEnvelopeValidator() {
    return (socket, next) => {
        const validatedSocket = socket;
        validatedSocket.validationStats = {
            messagesProcessed: 0,
            validationErrors: 0,
        };
        const originalOn = validatedSocket.on.bind(validatedSocket);
        validatedSocket.on = function (event, handler) {
            const wrappedHandler = (message) => {
                if (event.startsWith('disconnect') || event === 'error' || event === 'connect') {
                    handler(message);
                    return;
                }
                try {
                    const envelope = (0, message_envelope_1.validateEnvelope)(message, true);
                    validatedSocket.validationStats.messagesProcessed++;
                    const specificValidator = eventValidators.get(event);
                    if (specificValidator) {
                        const { error } = specificValidator.validate(message);
                        if (error) {
                            throw new Error(`Event-specific validation failed: ${error.message}`);
                        }
                    }
                    handler(envelope);
                }
                catch (err) {
                    validatedSocket.validationStats.validationErrors++;
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    logger_1.logger.warn(`WebSocket validation error on ${event}:`, {
                        socketId: socket.id,
                        error: errorMsg,
                        message: typeof message === 'object' ? JSON.stringify(message) : String(message),
                    });
                    socket.emit('validation-error', {
                        event,
                        error: errorMsg,
                    });
                }
            };
            return originalOn.call(validatedSocket, event, wrappedHandler);
        };
        next();
    };
}
function attachValidationStats(socket) {
    const validatedSocket = socket;
    socket.on('disconnect', () => {
        const stats = validatedSocket.validationStats;
        if (stats && (stats.messagesProcessed > 0 || stats.validationErrors > 0)) {
            logger_1.logger.debug(`WebSocket validation stats for ${socket.id}:`, {
                messagesProcessed: stats.messagesProcessed,
                validationErrors: stats.validationErrors,
                errorRate: stats.messagesProcessed > 0
                    ? `${((stats.validationErrors / stats.messagesProcessed) * 100).toFixed(2)}%`
                    : '0%',
            });
        }
    });
}
function withStrictValidation(handler) {
    return (socket, message) => {
        try {
            const envelope = (0, message_envelope_1.validateEnvelope)(message);
            return handler(socket, envelope);
        }
        catch (err) {
            logger_1.logger.error('Strict validation failed:', {
                socketId: socket.id,
                error: err instanceof Error ? err.message : String(err),
            });
            socket.emit('validation-error', {
                error: 'Strict validation failed',
            });
        }
    };
}
//# sourceMappingURL=schema-validator.js.map