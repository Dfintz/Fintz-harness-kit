import crypto from 'crypto';
import { EventEmitter } from 'events';

import { logger } from '../../utils/logger';

/**
 * Collaboration session participant
 */
export interface CollaborationParticipant {
  id: string;
  odId: string;
  username: string;
  avatarUrl?: string;
  role: 'owner' | 'editor' | 'viewer';
  cursorPosition?: { x: number; y: number };
  cursorColor: string;
  selectedElements: string[];
  joinedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

/**
 * Element lock for preventing edit conflicts
 */
export interface ElementLock {
  elementId: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
}

/**
 * Collaboration edit operation
 */
export interface CollaborationOperation {
  id: string;
  type: 'add' | 'update' | 'delete' | 'move' | 'select' | 'deselect';
  elementId?: string;
  userId: string;
  timestamp: Date;
  data: {
    element?: unknown;
    position?: { x: number; y: number };
    updates?: Record<string, unknown>;
    previousState?: unknown;
  };
  acknowledged: boolean;
}

/**
 * Collaboration session
 */
export interface CollaborationSession {
  id: string;
  briefingId: string;
  organizationId: string;
  createdAt: Date;
  participants: Map<string, CollaborationParticipant>;
  locks: Map<string, ElementLock>;
  operationHistory: CollaborationOperation[];
  undoStack: Map<string, CollaborationOperation[]>; // Per-user undo stacks
  isActive: boolean;
  lastActivityAt: Date;
}

/**
 * Cursor update event
 */
export interface CursorUpdate {
  userId: string;
  briefingId: string;
  position: { x: number; y: number };
  username: string;
  cursorColor: string;
}

/**
 * Selection update event
 */
export interface SelectionUpdate {
  userId: string;
  briefingId: string;
  selectedElements: string[];
  username: string;
  cursorColor: string;
}

/**
 * Element update event
 */
export interface ElementUpdate {
  briefingId: string;
  operation: CollaborationOperation;
}

/**
 * Participant status event
 */
export interface ParticipantStatus {
  briefingId: string;
  userId: string;
  username: string;
  status: 'joined' | 'left' | 'idle' | 'active';
}

/**
 * Collaboration events
 */
export interface CollaborationEvents {
  'cursor:update': CursorUpdate;
  'selection:update': SelectionUpdate;
  'element:update': ElementUpdate;
  'participant:status': ParticipantStatus;
  'session:created': { sessionId: string; briefingId: string };
  'session:ended': { sessionId: string; briefingId: string };
  'lock:acquired': { briefingId: string; elementId: string; userId: string };
  'lock:released': { briefingId: string; elementId: string; userId: string };
  'conflict:detected': { briefingId: string; elementId: string; users: string[] };
}

// Cursor colors for participants
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

/**
 * Briefing Collaboration Service
 * Provides real-time collaborative editing capabilities for briefings
 *
 * Improvement #2 from Content Domain review:
 * "Implement real-time collaborative editing"
 */
export class BriefingCollaborationService extends EventEmitter {
  private static instance: BriefingCollaborationService;
  private readonly sessions: Map<string, CollaborationSession> = new Map();
  private readonly userColorAssignments: Map<string, string> = new Map();
  private colorIndex = 0;
  private lockTimeout = 30000; // 30 seconds lock timeout
  private idleTimeout = 60000; // 60 seconds idle timeout
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startCleanupInterval();
    logger.info('BriefingCollaborationService initialized');
  }

  public static getInstance(): BriefingCollaborationService {
    if (!BriefingCollaborationService.instance) {
      BriefingCollaborationService.instance = new BriefingCollaborationService();
    }
    return BriefingCollaborationService.instance;
  }

  /**
   * Start cleanup interval for expired locks and idle participants
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
      this.cleanupIdleParticipants();
    }, 10000); // Run every 10 seconds
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Assign a unique cursor color to a user
   */
  private assignCursorColor(userId: string): string {
    let color = this.userColorAssignments.get(userId);
    if (!color) {
      color = CURSOR_COLORS[this.colorIndex % CURSOR_COLORS.length];
      this.userColorAssignments.set(userId, color);
      this.colorIndex++;
    }
    return color;
  }

  /**
   * Validate tenant isolation when joining an existing session
   */
  private validateSessionTenant(
    session: CollaborationSession,
    organizationId: string | undefined,
    briefingId: string
  ): void {
    if (!organizationId) {
      if (session.organizationId !== 'unscoped') {
        throw new Error('organizationId is required to join this collaboration session');
      }
      return;
    }

    if (session.organizationId === 'unscoped') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Cannot migrate unscoped session to tenant-scoped in production. Please recreate the session.'
        );
      }
      logger.warn('Migrating unscoped session to tenant-scoped (test/dev only)', {
        briefingId,
        organizationId,
      });
      session.organizationId = organizationId;
    } else if (session.organizationId !== organizationId) {
      throw new Error('Access denied: briefing belongs to a different organization');
    }
  }

  /**
   * Create or join a collaboration session for a briefing.
   * Enforces tenant isolation: all participants in a session must share the same organizationId.
   */
  public joinSession(
    briefingId: string,
    userId: string,
    username: string,
    role: 'owner' | 'editor' | 'viewer' = 'editor',
    avatarUrl?: string,
    organizationId?: string
  ): CollaborationSession {
    let session = this.sessions.get(briefingId);

    if (!session) {
      // Create new session — organizationId is required for tenant isolation in production.
      // When omitted, a placeholder is used (backward compat for in-memory/test scenarios).
      const effectiveOrgId = organizationId || 'unscoped';

      // In production, warn if creating unscoped session (should only happen in tests)
      if (!organizationId && process.env.NODE_ENV === 'production') {
        logger.warn('Creating unscoped collaboration session in production', { briefingId });
      }

      // Create new session
      session = {
        id: `collab-${crypto.randomUUID()}`,
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
      logger.info('Collaboration session created', {
        sessionId: session.id,
        briefingId,
        organizationId,
      });
    } else {
      // Existing session found — enforce tenant isolation.
      this.validateSessionTenant(session, organizationId, briefingId);
    }

    // Add participant if not already present
    if (!session.participants.has(userId)) {
      const cursorColor = this.assignCursorColor(userId);
      const participant: CollaborationParticipant = {
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

      // Emit participant joined event
      this.emit('participant:status', {
        briefingId,
        userId,
        username,
        status: 'joined',
      });

      logger.info('Participant joined session', { briefingId, userId, username });
    }

    return session;
  }

  /**
   * Leave a collaboration session
   */
  public leaveSession(briefingId: string, userId: string): void {
    const session = this.sessions.get(briefingId);
    if (!session) {
      return;
    }

    const participant = session.participants.get(userId);
    if (participant) {
      // Release all locks held by this user
      this.releaseAllUserLocks(briefingId, userId);

      // Remove participant
      session.participants.delete(userId);
      session.undoStack.delete(userId);

      // Emit participant left event
      this.emit('participant:status', {
        briefingId,
        userId,
        username: participant.username,
        status: 'left',
      });

      logger.info('Participant left session', { briefingId, userId });

      // End session if no participants remain
      if (session.participants.size === 0) {
        this.endSession(briefingId);
      }
    }
  }

  /**
   * End a collaboration session
   */
  public endSession(briefingId: string): void {
    const session = this.sessions.get(briefingId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(briefingId);

      this.emit('session:ended', { sessionId: session.id, briefingId });
      logger.info('Collaboration session ended', { sessionId: session.id, briefingId });
    }
  }

  /**
   * Get active session for a briefing
   */
  public getSession(briefingId: string): CollaborationSession | undefined {
    return this.sessions.get(briefingId);
  }

  /**
   * Get participants in a session
   */
  public getParticipants(briefingId: string): CollaborationParticipant[] {
    const session = this.sessions.get(briefingId);
    return session ? Array.from(session.participants.values()) : [];
  }

  /**
   * Update cursor position
   */
  public updateCursor(
    briefingId: string,
    userId: string,
    position: { x: number; y: number }
  ): void {
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

      // Emit cursor update event
      this.emit('cursor:update', {
        userId,
        briefingId,
        position,
        username: participant.username,
        cursorColor: participant.cursorColor,
      });
    }
  }

  /**
   * Update selection
   */
  public updateSelection(briefingId: string, userId: string, selectedElements: string[]): void {
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

      // Emit selection update event
      this.emit('selection:update', {
        userId,
        briefingId,
        selectedElements,
        username: participant.username,
        cursorColor: participant.cursorColor,
      });
    }
  }

  /**
   * Acquire lock on an element
   */
  public acquireLock(briefingId: string, elementId: string, userId: string): boolean {
    const session = this.sessions.get(briefingId);
    if (!session) {
      return false;
    }

    const participant = session.participants.get(userId);
    if (!participant || participant.role === 'viewer') {
      return false;
    }

    // Check if element is already locked
    const existingLock = session.locks.get(elementId);
    if (existingLock) {
      // Check if lock has expired
      if (existingLock.expiresAt > new Date()) {
        if (existingLock.lockedBy !== userId) {
          // Emit conflict event
          this.emit('conflict:detected', {
            briefingId,
            elementId,
            users: [existingLock.lockedBy, userId],
          });
          return false;
        }
        // Extend existing lock
        existingLock.expiresAt = new Date(Date.now() + this.lockTimeout);
        return true;
      }
      // Lock expired, remove it
      session.locks.delete(elementId);
    }

    // Acquire new lock
    const lock: ElementLock = {
      elementId,
      lockedBy: userId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + this.lockTimeout),
    };
    session.locks.set(elementId, lock);

    this.emit('lock:acquired', { briefingId, elementId, userId });
    logger.debug('Lock acquired', { briefingId, elementId, userId });

    return true;
  }

  /**
   * Release lock on an element
   */
  public releaseLock(briefingId: string, elementId: string, userId: string): boolean {
    const session = this.sessions.get(briefingId);
    if (!session) {
      return false;
    }

    const lock = session.locks.get(elementId);
    if (lock?.lockedBy === userId) {
      session.locks.delete(elementId);
      this.emit('lock:released', { briefingId, elementId, userId });
      logger.debug('Lock released', { briefingId, elementId, userId });
      return true;
    }

    return false;
  }

  /**
   * Release all locks held by a user
   */
  private releaseAllUserLocks(briefingId: string, userId: string): void {
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

  /**
   * Check if an element is locked
   */
  public isElementLocked(
    briefingId: string,
    elementId: string
  ): { locked: boolean; lockedBy?: string } {
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

  /**
   * Apply an operation to the briefing
   */
  public applyOperation(
    briefingId: string,
    userId: string,
    operationType: 'add' | 'update' | 'delete' | 'move',
    data: {
      element?: unknown;
      elementId?: string;
      position?: { x: number; y: number };
      updates?: Record<string, unknown>;
    }
  ): CollaborationOperation | null {
    const session = this.sessions.get(briefingId);
    if (!session) {
      return null;
    }

    const participant = session.participants.get(userId);
    if (!participant || participant.role === 'viewer') {
      return null;
    }

    // For update/delete/move operations, check lock
    if (['update', 'delete', 'move'].includes(operationType) && data.elementId) {
      const lockStatus = this.isElementLocked(briefingId, data.elementId);
      if (lockStatus.locked && lockStatus.lockedBy !== userId) {
        logger.warn('Operation blocked: element locked by another user', {
          briefingId,
          elementId: data.elementId,
          userId,
          lockedBy: lockStatus.lockedBy,
        });
        return null;
      }
    }

    const operation: CollaborationOperation = {
      id: `op-${crypto.randomUUID()}`,
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

    // Add to operation history
    session.operationHistory.push(operation);

    // Add to user's undo stack
    const undoStack = session.undoStack.get(userId);
    if (undoStack) {
      undoStack.push(operation);
      // Keep only last 50 operations per user
      if (undoStack.length > 50) {
        undoStack.shift();
      }
    }

    // Update activity
    participant.lastActivityAt = new Date();
    session.lastActivityAt = new Date();

    // Emit element update event
    this.emit('element:update', { briefingId, operation });

    logger.debug('Operation applied', {
      briefingId,
      operationType,
      elementId: data.elementId,
      userId,
    });

    return operation;
  }

  /**
   * Undo last operation for a user
   */
  public undo(briefingId: string, userId: string): CollaborationOperation | null {
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

    // Create inverse operation
    const inverseOperation: CollaborationOperation = {
      id: `undo-${crypto.randomUUID()}`,
      type: this.getInverseOperationType(lastOperation.type),
      elementId: lastOperation.elementId,
      userId,
      timestamp: new Date(),
      data: {
        previousState: lastOperation.data,
      },
      acknowledged: true,
    };

    // Add inverse operation to history
    session.operationHistory.push(inverseOperation);

    // Emit element update event
    this.emit('element:update', { briefingId, operation: inverseOperation });

    logger.debug('Undo applied', { briefingId, userId, operationId: lastOperation.id });

    return inverseOperation;
  }

  /**
   * Get inverse operation type
   */
  private getInverseOperationType(
    type: CollaborationOperation['type']
  ): CollaborationOperation['type'] {
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

  /**
   * Get operation history for a session
   */
  public getOperationHistory(briefingId: string, limit = 100): CollaborationOperation[] {
    const session = this.sessions.get(briefingId);
    if (!session) {
      return [];
    }

    return session.operationHistory.slice(-limit);
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = new Date();

    for (const [briefingId, session] of this.sessions) {
      for (const [elementId, lock] of session.locks) {
        if (lock.expiresAt <= now) {
          session.locks.delete(elementId);
          this.emit('lock:released', { briefingId, elementId, userId: lock.lockedBy });
          logger.debug('Expired lock released', { briefingId, elementId, lockedBy: lock.lockedBy });
        }
      }
    }
  }

  /**
   * Clean up idle participants
   */
  private cleanupIdleParticipants(): void {
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

          logger.debug('Participant marked as idle', { briefingId, userId });
        }
      }
    }
  }

  /**
   * Mark participant as active
   */
  public markActive(briefingId: string, userId: string): void {
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

  /**
   * Get all active sessions
   */
  public getActiveSessions(): {
    briefingId: string;
    participantCount: number;
    lastActivityAt: Date;
  }[] {
    return Array.from(this.sessions.entries()).map(([briefingId, session]) => ({
      briefingId,
      participantCount: session.participants.size,
      lastActivityAt: session.lastActivityAt,
    }));
  }

  /**
   * Get session statistics
   */
  public getStats(): {
    activeSessions: number;
    totalParticipants: number;
    totalLocks: number;
    totalOperations: number;
  } {
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

  /**
   * Clear all sessions (for testing)
   */
  public clearAllSessions(): void {
    for (const briefingId of this.sessions.keys()) {
      this.endSession(briefingId);
    }
    this.sessions.clear();
    logger.info('All collaboration sessions cleared');
  }

  /**
   * Set lock timeout (for testing)
   */
  public setLockTimeout(timeout: number): void {
    this.lockTimeout = timeout;
  }

  /**
   * Set idle timeout (for testing)
   */
  public setIdleTimeout(timeout: number): void {
    this.idleTimeout = timeout;
  }
}

