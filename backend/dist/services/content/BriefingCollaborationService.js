"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BriefingCollaborationService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
const CURSOR_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
];
class BriefingCollaborationService extends events_1.EventEmitter {
    static instance;
    sessions = new Map();
    userColorAssignments = new Map();
    colorIndex = 0;
    lockTimeout = 30000;
    idleTimeout = 60000;
    cleanupInterval = null;
    constructor() {
        super();
        this.startCleanupInterval();
        logger_1.logger.info('BriefingCollaborationService initialized');
    }
    static getInstance() {
        if (!BriefingCollaborationService.instance) {
            BriefingCollaborationService.instance = new BriefingCollaborationService();
        }
        return BriefingCollaborationService.instance;
    }
    startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredLocks();
            this.cleanupIdleParticipants();
        }, 10000);
    }
    stopCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    assignCursorColor(userId) {
        let color = this.userColorAssignments.get(userId);
        if (!color) {
            color = CURSOR_COLORS[this.colorIndex % CURSOR_COLORS.length];
            this.userColorAssignments.set(userId, color);
            this.colorIndex++;
        }
        return color;
    }
    validateSessionTenant(session, organizationId, briefingId) {
        if (!organizationId) {
            if (session.organizationId !== 'unscoped') {
                throw new Error('organizationId is required to join this collaboration session');
            }
            return;
        }
        if (session.organizationId === 'unscoped') {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('Cannot migrate unscoped session to tenant-scoped in production. Please recreate the session.');
            }
            logger_1.logger.warn('Migrating unscoped session to tenant-scoped (test/dev only)', {
                briefingId,
                organizationId,
            });
            session.organizationId = organizationId;
        }
        else if (session.organizationId !== organizationId) {
            throw new Error('Access denied: briefing belongs to a different organization');
        }
    }
    joinSession(briefingId, userId, username, role = 'editor', avatarUrl, organizationId) {
        let session = this.sessions.get(briefingId);
        if (!session) {
            const effectiveOrgId = organizationId || 'unscoped';
            if (!organizationId && process.env.NODE_ENV === 'production') {
                logger_1.logger.warn('Creating unscoped collaboration session in production', { briefingId });
            }
            session = {
                id: `collab-${crypto_1.default.randomUUID()}`,
                briefingId,
                organizationId: effectiveOrgId,
                createdAt: new Date(),
                participants: new Map(),
                locks: new Map(),
                operationHistory: [],
                undoStack: new Map(),
                isActive: true,
                lastActivityAt: new Date(),
            };
            this.sessions.set(briefingId, session);
            this.emit('session:created', { sessionId: session.id, briefingId });
            logger_1.logger.info('Collaboration session created', {
                sessionId: session.id,
                briefingId,
                organizationId,
            });
        }
        else {
            this.validateSessionTenant(session, organizationId, briefingId);
        }
        if (!session.participants.has(userId)) {
            const cursorColor = this.assignCursorColor(userId);
            const participant = {
                id: userId,
                odId: `participant-${Date.now()}`,
                username,
                avatarUrl,
                role,
                cursorColor,
                selectedElements: [],
                joinedAt: new Date(),
                lastActivityAt: new Date(),
                isActive: true,
            };
            session.participants.set(userId, participant);
            session.undoStack.set(userId, []);
            this.emit('participant:status', {
                briefingId,
                userId,
                username,
                status: 'joined',
            });
            logger_1.logger.info('Participant joined session', { briefingId, userId, username });
        }
        return session;
    }
    leaveSession(briefingId, userId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return;
        }
        const participant = session.participants.get(userId);
        if (participant) {
            this.releaseAllUserLocks(briefingId, userId);
            session.participants.delete(userId);
            session.undoStack.delete(userId);
            this.emit('participant:status', {
                briefingId,
                userId,
                username: participant.username,
                status: 'left',
            });
            logger_1.logger.info('Participant left session', { briefingId, userId });
            if (session.participants.size === 0) {
                this.endSession(briefingId);
            }
        }
    }
    endSession(briefingId) {
        const session = this.sessions.get(briefingId);
        if (session) {
            session.isActive = false;
            this.sessions.delete(briefingId);
            this.emit('session:ended', { sessionId: session.id, briefingId });
            logger_1.logger.info('Collaboration session ended', { sessionId: session.id, briefingId });
        }
    }
    getSession(briefingId) {
        return this.sessions.get(briefingId);
    }
    getParticipants(briefingId) {
        const session = this.sessions.get(briefingId);
        return session ? Array.from(session.participants.values()) : [];
    }
    updateCursor(briefingId, userId, position) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return;
        }
        const participant = session.participants.get(userId);
        if (participant) {
            participant.cursorPosition = position;
            participant.lastActivityAt = new Date();
            participant.isActive = true;
            session.lastActivityAt = new Date();
            this.emit('cursor:update', {
                userId,
                briefingId,
                position,
                username: participant.username,
                cursorColor: participant.cursorColor,
            });
        }
    }
    updateSelection(briefingId, userId, selectedElements) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return;
        }
        const participant = session.participants.get(userId);
        if (participant) {
            participant.selectedElements = selectedElements;
            participant.lastActivityAt = new Date();
            participant.isActive = true;
            session.lastActivityAt = new Date();
            this.emit('selection:update', {
                userId,
                briefingId,
                selectedElements,
                username: participant.username,
                cursorColor: participant.cursorColor,
            });
        }
    }
    acquireLock(briefingId, elementId, userId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return false;
        }
        const participant = session.participants.get(userId);
        if (!participant || participant.role === 'viewer') {
            return false;
        }
        const existingLock = session.locks.get(elementId);
        if (existingLock) {
            if (existingLock.expiresAt > new Date()) {
                if (existingLock.lockedBy !== userId) {
                    this.emit('conflict:detected', {
                        briefingId,
                        elementId,
                        users: [existingLock.lockedBy, userId],
                    });
                    return false;
                }
                existingLock.expiresAt = new Date(Date.now() + this.lockTimeout);
                return true;
            }
            session.locks.delete(elementId);
        }
        const lock = {
            elementId,
            lockedBy: userId,
            lockedAt: new Date(),
            expiresAt: new Date(Date.now() + this.lockTimeout),
        };
        session.locks.set(elementId, lock);
        this.emit('lock:acquired', { briefingId, elementId, userId });
        logger_1.logger.debug('Lock acquired', { briefingId, elementId, userId });
        return true;
    }
    releaseLock(briefingId, elementId, userId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return false;
        }
        const lock = session.locks.get(elementId);
        if (lock?.lockedBy === userId) {
            session.locks.delete(elementId);
            this.emit('lock:released', { briefingId, elementId, userId });
            logger_1.logger.debug('Lock released', { briefingId, elementId, userId });
            return true;
        }
        return false;
    }
    releaseAllUserLocks(briefingId, userId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return;
        }
        for (const [elementId, lock] of session.locks) {
            if (lock.lockedBy === userId) {
                session.locks.delete(elementId);
                this.emit('lock:released', { briefingId, elementId, userId });
            }
        }
    }
    isElementLocked(briefingId, elementId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return { locked: false };
        }
        const lock = session.locks.get(elementId);
        if (lock && lock.expiresAt > new Date()) {
            return { locked: true, lockedBy: lock.lockedBy };
        }
        return { locked: false };
    }
    applyOperation(briefingId, userId, operationType, data) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return null;
        }
        const participant = session.participants.get(userId);
        if (!participant || participant.role === 'viewer') {
            return null;
        }
        if (['update', 'delete', 'move'].includes(operationType) && data.elementId) {
            const lockStatus = this.isElementLocked(briefingId, data.elementId);
            if (lockStatus.locked && lockStatus.lockedBy !== userId) {
                logger_1.logger.warn('Operation blocked: element locked by another user', {
                    briefingId,
                    elementId: data.elementId,
                    userId,
                    lockedBy: lockStatus.lockedBy,
                });
                return null;
            }
        }
        const operation = {
            id: `op-${crypto_1.default.randomUUID()}`,
            type: operationType,
            elementId: data.elementId,
            userId,
            timestamp: new Date(),
            data: {
                element: data.element,
                position: data.position,
                updates: data.updates,
            },
            acknowledged: true,
        };
        session.operationHistory.push(operation);
        const undoStack = session.undoStack.get(userId);
        if (undoStack) {
            undoStack.push(operation);
            if (undoStack.length > 50) {
                undoStack.shift();
            }
        }
        participant.lastActivityAt = new Date();
        session.lastActivityAt = new Date();
        this.emit('element:update', { briefingId, operation });
        logger_1.logger.debug('Operation applied', {
            briefingId,
            operationType,
            elementId: data.elementId,
            userId,
        });
        return operation;
    }
    undo(briefingId, userId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return null;
        }
        const undoStack = session.undoStack.get(userId);
        if (!undoStack || undoStack.length === 0) {
            return null;
        }
        const lastOperation = undoStack.pop();
        if (!lastOperation) {
            return null;
        }
        const inverseOperation = {
            id: `undo-${crypto_1.default.randomUUID()}`,
            type: this.getInverseOperationType(lastOperation.type),
            elementId: lastOperation.elementId,
            userId,
            timestamp: new Date(),
            data: {
                previousState: lastOperation.data,
            },
            acknowledged: true,
        };
        session.operationHistory.push(inverseOperation);
        this.emit('element:update', { briefingId, operation: inverseOperation });
        logger_1.logger.debug('Undo applied', { briefingId, userId, operationId: lastOperation.id });
        return inverseOperation;
    }
    getInverseOperationType(type) {
        switch (type) {
            case 'add':
                return 'delete';
            case 'delete':
                return 'add';
            case 'update':
                return 'update';
            case 'move':
                return 'move';
            case 'select':
                return 'deselect';
            case 'deselect':
                return 'select';
            default:
                return type;
        }
    }
    getOperationHistory(briefingId, limit = 100) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return [];
        }
        return session.operationHistory.slice(-limit);
    }
    cleanupExpiredLocks() {
        const now = new Date();
        for (const [briefingId, session] of this.sessions) {
            for (const [elementId, lock] of session.locks) {
                if (lock.expiresAt <= now) {
                    session.locks.delete(elementId);
                    this.emit('lock:released', { briefingId, elementId, userId: lock.lockedBy });
                    logger_1.logger.debug('Expired lock released', { briefingId, elementId, lockedBy: lock.lockedBy });
                }
            }
        }
    }
    cleanupIdleParticipants() {
        const idleThreshold = new Date(Date.now() - this.idleTimeout);
        for (const [briefingId, session] of this.sessions) {
            for (const [userId, participant] of session.participants) {
                if (participant.lastActivityAt < idleThreshold && participant.isActive) {
                    participant.isActive = false;
                    this.emit('participant:status', {
                        briefingId,
                        userId,
                        username: participant.username,
                        status: 'idle',
                    });
                    logger_1.logger.debug('Participant marked as idle', { briefingId, userId });
                }
            }
        }
    }
    markActive(briefingId, userId) {
        const session = this.sessions.get(briefingId);
        if (!session) {
            return;
        }
        const participant = session.participants.get(userId);
        if (participant && !participant.isActive) {
            participant.isActive = true;
            participant.lastActivityAt = new Date();
            this.emit('participant:status', {
                briefingId,
                userId,
                username: participant.username,
                status: 'active',
            });
        }
    }
    getActiveSessions() {
        return Array.from(this.sessions.entries()).map(([briefingId, session]) => ({
            briefingId,
            participantCount: session.participants.size,
            lastActivityAt: session.lastActivityAt,
        }));
    }
    getStats() {
        let totalParticipants = 0;
        let totalLocks = 0;
        let totalOperations = 0;
        for (const session of this.sessions.values()) {
            totalParticipants += session.participants.size;
            totalLocks += session.locks.size;
            totalOperations += session.operationHistory.length;
        }
        return {
            activeSessions: this.sessions.size,
            totalParticipants,
            totalLocks,
            totalOperations,
        };
    }
    clearAllSessions() {
        for (const briefingId of this.sessions.keys()) {
            this.endSession(briefingId);
        }
        this.sessions.clear();
        logger_1.logger.info('All collaboration sessions cleared');
    }
    setLockTimeout(timeout) {
        this.lockTimeout = timeout;
    }
    setIdleTimeout(timeout) {
        this.idleTimeout = timeout;
    }
}
exports.BriefingCollaborationService = BriefingCollaborationService;
//# sourceMappingURL=BriefingCollaborationService.js.map