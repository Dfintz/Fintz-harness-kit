const mockGetActivityById = jest.fn();
const mockPublishMirrorSync = jest.fn();
const mockLogAuditEvent = jest.fn();

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
  })),
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorSync: (...args: unknown[]) => mockPublishMirrorSync(...args),
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

import { triggerMirrorSync } from '../eventButtons.mirrorSync';

describe('eventButtons.mirrorSync seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActivityById.mockResolvedValue({ currentParticipants: 7, maxParticipants: 20 });
    mockPublishMirrorSync.mockResolvedValue(undefined);
  });

  it('does not publish for non-RSVP actions', async () => {
    triggerMirrorSync('activity-1', 'user-1', 'Pilot', 'actions');
    await flushMicrotasks();

    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(mockPublishMirrorSync).not.toHaveBeenCalled();
  });

  it('publishes for RSVP/leave actions with expected payload', async () => {
    triggerMirrorSync('activity-1', 'user-1', 'Pilot', 'join');
    await flushMicrotasks();

    expect(mockGetActivityById).toHaveBeenCalledWith('activity-1');
    expect(mockPublishMirrorSync).toHaveBeenCalledWith({
      activityId: 'activity-1',
      userId: 'user-1',
      action: 'join',
      currentParticipants: 7,
      maxParticipants: 20,
    });
  });

  it('uses fallback payload when activity lookup resolves undefined', async () => {
    mockGetActivityById.mockResolvedValueOnce(undefined);

    triggerMirrorSync('activity-1', 'user-1', 'Pilot', 'leave');
    await flushMicrotasks();

    expect(mockPublishMirrorSync).toHaveBeenCalledWith({
      activityId: 'activity-1',
      userId: 'user-1',
      action: 'leave',
      currentParticipants: 0,
      maxParticipants: undefined,
    });
  });

  it('logs MIRROR_SYNC_FAILED when activity lookup rejects', async () => {
    mockGetActivityById.mockRejectedValueOnce(new Error('db offline'));

    triggerMirrorSync('activity-1', 'user-1', 'Pilot', 'decline');
    await flushMicrotasks();

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MIRROR_SYNC_FAILED',
        metadata: { activityId: 'activity-1', action: 'decline' },
      })
    );
  });

  it('logs MIRROR_SYNC_FAILED when publish rejects', async () => {
    mockPublishMirrorSync.mockRejectedValueOnce(new Error('pub failed'));

    triggerMirrorSync('activity-1', 'user-1', 'Pilot', 'tentative');
    await flushMicrotasks();

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MIRROR_SYNC_FAILED',
        metadata: { activityId: 'activity-1', action: 'tentative' },
      })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
