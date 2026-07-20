import type { ConnectionNegotiation, HeartbeatMessage, MessageEnvelope } from '@sc-fleet-manager/shared-types';
import Joi from 'joi';
export type { ConnectionNegotiation, HeartbeatMessage, MessageEnvelope };
export declare const messageEnvelopeSchema: Joi.ObjectSchema<MessageEnvelope>;
export declare const heartbeatSchema: Joi.ObjectSchema<HeartbeatMessage>;
export declare const negotiationSchema: Joi.ObjectSchema<ConnectionNegotiation>;
export declare function validateEnvelope(message: unknown, allowDefault?: boolean): MessageEnvelope;
export declare function createHeartbeat(type: 'ping' | 'pong'): HeartbeatMessage;
export declare function createNegotiation(clientVersion: number, supportedVersions: number[], clientId?: string): ConnectionNegotiation;
//# sourceMappingURL=message-envelope.d.ts.map