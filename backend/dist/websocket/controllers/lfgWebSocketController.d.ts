export interface LfgSessionEvent {
    type: 'lfg:session-created' | 'lfg:session-updated' | 'lfg:session-cancelled' | 'lfg:member-joined' | 'lfg:member-left';
    organizationId: string;
    sessionId: string;
    userId?: string;
    timestamp: number;
}
export declare const emitLfgSessionCreated: (organizationId: string, sessionId: string, userId?: string) => void;
export declare const emitLfgMemberJoined: (organizationId: string, sessionId: string, userId?: string) => void;
export declare const emitLfgMemberLeft: (organizationId: string, sessionId: string, userId?: string) => void;
export declare const emitLfgSessionUpdated: (organizationId: string, sessionId: string, userId?: string) => void;
export declare const emitLfgSessionCancelled: (organizationId: string, sessionId: string, userId?: string) => void;
//# sourceMappingURL=lfgWebSocketController.d.ts.map