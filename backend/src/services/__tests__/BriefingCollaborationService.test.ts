import { BriefingCollaborationService } from '../content/BriefingCollaborationService';

// Mock logger
describe('BriefingCollaborationService', () => {
  let collaborationService: BriefingCollaborationService;

  beforeEach(() => {
    collaborationService = BriefingCollaborationService.getInstance();
    collaborationService.clearAllSessions();
    collaborationService.removeAllListeners(); // Remove all event listeners
    collaborationService.setLockTimeout(5000); // 5 seconds for faster tests
    collaborationService.setIdleTimeout(10000); // 10 seconds for faster tests
  });

  afterEach(() => {
    collaborationService.clearAllSessions();
    collaborationService.removeAllListeners(); // Clean up event listeners
    collaborationService.stopCleanupInterval();
  });

  describe('joinSession', () => {
    it('should create a new session if none exists', () => {
      const session = collaborationService.joinSession(
        'briefing-1',
        'user-123',
        'John Doe',
        'owner'
      );

      expect(session).toBeDefined();
      expect(session.briefingId).toBe('briefing-1');
      expect(session.participants.size).toBe(1);
      expect(session.isActive).toBe(true);
    });

    it('should add participant to existing session', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'owner');
      const session = collaborationService.joinSession(
        'briefing-1',
        'user-2',
        'User Two',
        'editor'
      );

      expect(session.participants.size).toBe(2);
    });

    it('should not duplicate participant if already in session', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'owner');
      const session = collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'owner');

      expect(session.participants.size).toBe(1);
    });

    it('should assign unique cursor colors', () => {
      const session = collaborationService.joinSession('briefing-1', 'user-1', 'User One');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two');

      const participant1 = session.participants.get('user-1');
      const participant2 = session.participants.get('user-2');

      expect(participant1?.cursorColor).toBeDefined();
      expect(participant2?.cursorColor).toBeDefined();
      expect(participant1?.cursorColor).not.toBe(participant2?.cursorColor);
    });
  });

  describe('leaveSession', () => {
    it('should remove participant from session', () => {
      const session = collaborationService.joinSession('briefing-1', 'user-1', 'User One');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two');

      collaborationService.leaveSession('briefing-1', 'user-1');

      expect(session.participants.size).toBe(1);
      expect(session.participants.has('user-1')).toBe(false);
    });

    it('should end session when last participant leaves', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One');
      collaborationService.leaveSession('briefing-1', 'user-1');

      const session = collaborationService.getSession('briefing-1');
      expect(session).toBeUndefined();
    });

    it('should release all locks held by leaving participant', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');
      collaborationService.acquireLock('briefing-1', 'element-2', 'user-1');

      collaborationService.joinSession('briefing-1', 'user-2', 'User Two', 'editor');
      collaborationService.leaveSession('briefing-1', 'user-1');

      const lock1 = collaborationService.isElementLocked('briefing-1', 'element-1');
      const lock2 = collaborationService.isElementLocked('briefing-1', 'element-2');

      expect(lock1.locked).toBe(false);
      expect(lock2.locked).toBe(false);
    });
  });

  describe('getParticipants', () => {
    it('should return all participants in a session', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two');

      const participants = collaborationService.getParticipants('briefing-1');

      expect(participants).toHaveLength(2);
    });

    it('should return empty array for non-existent session', () => {
      const participants = collaborationService.getParticipants('non-existent');

      expect(participants).toHaveLength(0);
    });
  });

  describe('updateCursor', () => {
    it('should update cursor position for participant', () => {
      const session = collaborationService.joinSession('briefing-1', 'user-1', 'User One');

      collaborationService.updateCursor('briefing-1', 'user-1', { x: 100, y: 200 });

      const participant = session.participants.get('user-1');
      expect(participant?.cursorPosition).toEqual({ x: 100, y: 200 });
    });

    it('should emit cursor:update event', done => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One');

      collaborationService.on('cursor:update', data => {
        expect(data.userId).toBe('user-1');
        expect(data.position).toEqual({ x: 100, y: 200 });
        done();
      });

      collaborationService.updateCursor('briefing-1', 'user-1', { x: 100, y: 200 });
    });
  });

  describe('updateSelection', () => {
    it('should update selected elements for participant', () => {
      const session = collaborationService.joinSession('briefing-1', 'user-1', 'User One');

      collaborationService.updateSelection('briefing-1', 'user-1', ['elem-1', 'elem-2']);

      const participant = session.participants.get('user-1');
      expect(participant?.selectedElements).toEqual(['elem-1', 'elem-2']);
    });

    it('should emit selection:update event', done => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One');

      collaborationService.on('selection:update', data => {
        expect(data.selectedElements).toEqual(['elem-1', 'elem-2']);
        done();
      });

      collaborationService.updateSelection('briefing-1', 'user-1', ['elem-1', 'elem-2']);
    });
  });

  describe('acquireLock', () => {
    it('should acquire lock on element', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');

      const result = collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');

      expect(result).toBe(true);

      const lockStatus = collaborationService.isElementLocked('briefing-1', 'element-1');
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.lockedBy).toBe('user-1');
    });

    it('should deny lock if already locked by another user', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two', 'editor');

      collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');
      const result = collaborationService.acquireLock('briefing-1', 'element-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should extend lock if same user requests again', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');

      collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');
      const result = collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should deny lock for viewer role', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'viewer');

      const result = collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should release lock on element', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');

      const result = collaborationService.releaseLock('briefing-1', 'element-1', 'user-1');

      expect(result).toBe(true);

      const lockStatus = collaborationService.isElementLocked('briefing-1', 'element-1');
      expect(lockStatus.locked).toBe(false);
    });

    it('should not release lock held by different user', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two', 'editor');
      collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');

      const result = collaborationService.releaseLock('briefing-1', 'element-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('applyOperation', () => {
    it('should apply add operation', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');

      const operation = collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
        element: { id: 'elem-1', type: 'marker', position: { x: 100, y: 200 } },
      });

      expect(operation).toBeDefined();
      expect(operation?.type).toBe('add');
      expect(operation?.acknowledged).toBe(true);
    });

    it('should deny operation for viewer role', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'viewer');

      const operation = collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
        element: { id: 'elem-1' },
      });

      expect(operation).toBeNull();
    });

    it('should deny update if element is locked by another user', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two', 'editor');
      collaborationService.acquireLock('briefing-1', 'element-1', 'user-1');

      const operation = collaborationService.applyOperation('briefing-1', 'user-2', 'update', {
        elementId: 'element-1',
        updates: { position: { x: 150, y: 250 } },
      });

      expect(operation).toBeNull();
    });

    it('should add operation to history', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
        element: { id: 'elem-1' },
      });

      const history = collaborationService.getOperationHistory('briefing-1');

      expect(history).toHaveLength(1);
    });

    it('should emit element:update event', done => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');

      collaborationService.on('element:update', data => {
        expect(data.operation.type).toBe('add');
        done();
      });

      collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
        element: { id: 'elem-1' },
      });
    });
  });

  describe('undo', () => {
    it('should undo last operation', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
        element: { id: 'elem-1' },
      });

      const undoOp = collaborationService.undo('briefing-1', 'user-1');

      expect(undoOp).toBeDefined();
      expect(undoOp?.type).toBe('delete'); // Inverse of add
    });

    it('should return null if no operations to undo', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');

      const undoOp = collaborationService.undo('briefing-1', 'user-1');

      expect(undoOp).toBeNull();
    });
  });

  describe('getOperationHistory', () => {
    it('should return operation history with limit', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');

      for (let i = 0; i < 10; i++) {
        collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
          element: { id: `elem-${i}` },
        });
      }

      const history = collaborationService.getOperationHistory('briefing-1', 5);

      expect(history).toHaveLength(5);
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One');
      collaborationService.joinSession('briefing-2', 'user-2', 'User Two');

      const sessions = collaborationService.getActiveSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.some(s => s.briefingId === 'briefing-1')).toBe(true);
      expect(sessions.some(s => s.briefingId === 'briefing-2')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One', 'editor');
      collaborationService.joinSession('briefing-1', 'user-2', 'User Two', 'editor');
      collaborationService.joinSession('briefing-2', 'user-3', 'User Three', 'editor');
      collaborationService.acquireLock('briefing-1', 'elem-1', 'user-1');
      collaborationService.applyOperation('briefing-1', 'user-1', 'add', {
        element: { id: 'elem-1' },
      });

      const stats = collaborationService.getStats();

      expect(stats.activeSessions).toBe(2);
      expect(stats.totalParticipants).toBe(3);
      expect(stats.totalLocks).toBe(1);
      expect(stats.totalOperations).toBe(1);
    });
  });

  describe('markActive', () => {
    it('should mark idle participant as active', () => {
      const session = collaborationService.joinSession('briefing-1', 'user-1', 'User One');
      const participant = session.participants.get('user-1')!;
      participant.isActive = false;

      collaborationService.markActive('briefing-1', 'user-1');

      expect(participant.isActive).toBe(true);
    });
  });

  describe('endSession', () => {
    it('should end a session', () => {
      collaborationService.joinSession('briefing-1', 'user-1', 'User One');

      collaborationService.endSession('briefing-1');

      const session = collaborationService.getSession('briefing-1');
      expect(session).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

