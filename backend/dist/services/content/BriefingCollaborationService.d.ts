import { EventEmitter } from 'events';
export interface CollaborationParticipant {
    id: string;
    odId: string;
    username: string;
    avatarUrl?: string;
    role: 'owner' | 'editor' | 'viewer';
    cursorPosition?: {
        x: number;
        y: number;
    };
    cursorColor: string;
    selectedElements: string[];
    joinedAt: Date;
    lastActivityAt: Date;
    isActive: boolean;
}
export interface ElementLock {
    elementId: string;
    lockedBy: string;
    lockedAt: Date;
    expiresAt: Date;
}
export interface CollaborationOperation {
    id: string;
    type: 'add' | 'update' | 'delete' | 'move' | 'select' | 'deselect';
    elementId?: string;
    userId: string;
    timestamp: Date;
    data: {
        element?: unknown;
        position?: {
            x: number;
            y: number;
        };
        updates?: Record<string, unknown>;
        previousState?: unknown;
    };
    acknowledged: boolean;
}
export interface CollaborationSession {
    id: string;
    briefingId: string;
    organizationId: string;
    createdAt: Date;
    participants: Map<string, CollaborationParticipant>;
    locks: Map<string, ElementLock>;
    operationHistory: CollaborationOperation[];
    undoStack: Map<string, CollaborationOperation[]>;
    isActive: boolean;
    lastActivityAt: Date;
}
export interface CursorUpdate {
    userId: string;
    briefingId: string;
    position: {
        x: number;
        y: number;
    };
    username: string;
    cursorColor: string;
}
export interface SelectionUpdate {
    userId: string;
    briefingId: string;
    selectedElements: string[];
    username: string;
    cursorColor: string;
}
export interface ElementUpdate {
    briefingId: string;
    operation: CollaborationOperation;
}
export interface ParticipantStatus {
    briefingId: string;
    userId: string;
    username: string;
    status: 'joined' | 'left' | 'idle' | 'active';
}
export interface CollaborationEvents {
    'cursor:update': CursorUpdate;
    'selection:update': SelectionUpdate;
    'element:update': ElementUpdate;
    'participant:status': ParticipantStatus;
    'session:created': {
        sessionId: string;
        briefingId: string;
    };
    'session:ended': {
        sessionId: string;
        briefingId: string;
    };
    'lock:acquired': {
        briefingId: string;
        elementId: string;
        userId: string;
    };
    'lock:released': {
        briefingId: string;
        elementId: string;
        userId: string;
    };
    'conflict:detected': {
        briefingId: string;
        elementId: string;
        users: string[];
    };
}
export declare class BriefingCollaborationService extends EventEmitter {
    private static instance;
    private readonly sessions;
    private readonly userColorAssignments;
    private colorIndex;
    private lockTimeout;
    private idleTimeout;
    private cleanupInterval;
    private constructor();
    static getInstance(): BriefingCollaborationService;
    private startCleanupInterval;
    stopCleanupInterval(): void;
    private assignCursorColor;
    private validateSessionTenant;
    joinSession(briefingId: string, userId: string, username: string, role?: 'owner' | 'editor' | 'viewer', avatarUrl?: string, organizationId?: string): CollaborationSession;
    leaveSession(briefingId: string, userId: string): void;
    endSession(briefingId: string): void;
    getSession(briefingId: string): CollaborationSession | undefined;
    getParticipants(briefingId: string): CollaborationParticipant[];
    updateCursor(briefingId: string, userId: string, position: {
        x: number;
        y: number;
    }): void;
    updateSelection(briefingId: string, userId: string, selectedElements: string[]): void;
    acquireLock(briefingId: string, elementId: string, userId: string): boolean;
    releaseLock(briefingId: string, elementId: string, userId: string): boolean;
    private releaseAllUserLocks;
    isElementLocked(briefingId: string, elementId: string): {
        locked: boolean;
        lockedBy?: string;
    };
    applyOperation(briefingId: string, userId: string, operationType: 'add' | 'update' | 'delete' | 'move', data: {
        element?: unknown;
        elementId?: string;
        position?: {
            x: number;
            y: number;
        };
        updates?: Record<string, unknown>;
    }): CollaborationOperation | null;
    undo(briefingId: string, userId: string): CollaborationOperation | null;
    private getInverseOperationType;
    getOperationHistory(briefingId: string, limit?: number): CollaborationOperation[];
    private cleanupExpiredLocks;
    private cleanupIdleParticipants;
    markActive(briefingId: string, userId: string): void;
    getActiveSessions(): {
        briefingId: string;
        participantCount: number;
        lastActivityAt: Date;
    }[];
    getStats(): {
        activeSessions: number;
        totalParticipants: number;
        totalLocks: number;
        totalOperations: number;
    };
    clearAllSessions(): void;
    setLockTimeout(timeout: number): void;
    setIdleTimeout(timeout: number): void;
}
//# sourceMappingURL=BriefingCollaborationService.d.ts.map