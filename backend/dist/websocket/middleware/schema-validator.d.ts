import { Socket } from 'socket.io';
import { MessageEnvelope } from '../schemas/message-envelope';
export interface ValidationError {
    event: string;
    socketId: string;
    error: string;
    rawMessage?: unknown;
}
export declare function createEnvelopeValidator(): (socket: Socket, next: (err?: Error) => void) => void;
export declare function attachValidationStats(socket: Socket): void;
export declare function withStrictValidation<T>(handler: (socket: Socket, message: MessageEnvelope<T>) => void): (socket: Socket, message: unknown) => void;
//# sourceMappingURL=schema-validator.d.ts.map