"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.negotiationSchema = exports.heartbeatSchema = exports.messageEnvelopeSchema = void 0;
exports.validateEnvelope = validateEnvelope;
exports.createHeartbeat = createHeartbeat;
exports.createNegotiation = createNegotiation;
const joi_1 = __importDefault(require("joi"));
exports.messageEnvelopeSchema = joi_1.default.object({
    type: joi_1.default.string().required().max(50).description('Message type identifier'),
    version: joi_1.default.number().required().integer().min(1).max(100).description('Schema version'),
    payload: joi_1.default.any().required().description('Typed message payload'),
    timestamp: joi_1.default.string().required().isoDate().description('ISO 8601 timestamp'),
    messageId: joi_1.default.string().optional().uuid().description('Optional message correlation ID'),
});
exports.heartbeatSchema = joi_1.default.object({
    type: joi_1.default.string().required().valid('ping', 'pong'),
    version: joi_1.default.number().required().equal(1),
    payload: joi_1.default.valid(null).required(),
    timestamp: joi_1.default.string().required().isoDate(),
    messageId: joi_1.default.string().optional(),
});
exports.negotiationSchema = joi_1.default.object({
    type: joi_1.default.string().required().equal('negotiate'),
    version: joi_1.default.number().required().equal(1),
    payload: joi_1.default.object({
        clientVersion: joi_1.default.number().required().integer().min(1),
        supportedVersions: joi_1.default.array().items(joi_1.default.number().integer().min(1)).required(),
        clientId: joi_1.default.string().optional(),
    }),
    timestamp: joi_1.default.string().required().isoDate(),
});
function validateEnvelope(message, allowDefault = false) {
    if (allowDefault && typeof message === 'object' && message !== null) {
        const msg = message;
        if (!('version' in msg)) {
            msg.version = 1;
        }
        if (!('timestamp' in msg)) {
            msg.timestamp = new Date().toISOString();
        }
    }
    const { error, value } = exports.messageEnvelopeSchema.validate(message, {
        abortEarly: false,
        convert: false,
    });
    if (error) {
        throw new Error(`Invalid message envelope: ${error.message}`);
    }
    return value;
}
function createHeartbeat(type) {
    return {
        type,
        version: 1,
        payload: null,
        timestamp: new Date().toISOString(),
    };
}
function createNegotiation(clientVersion, supportedVersions, clientId) {
    return {
        type: 'negotiate',
        version: 1,
        payload: {
            clientVersion,
            supportedVersions,
            clientId,
        },
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=message-envelope.js.map