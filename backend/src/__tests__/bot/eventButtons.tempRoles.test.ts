const mockGetActivityById = jest.fn();
const mockAssignTempRole = jest.fn();
const mockRemoveTempRole = jest.fn();

jest.mock('../../services/activity', () => ({
  ActivityService: jest.fn(),
}));

jest.mock('../../services/activity/EventTempRoleService', () => ({
  EventTempRoleService: {
    getInstance: jest.fn().mockReturnValue({
      assignTempRole: (...args: unknown[]) => mockAssignTempRole(...args),
      removeTempRole: (...args: unknown[]) => mockRemoveTempRole(...args),
    }),
  },
}));

jest.mock('../../bot/interactions/eventButtons.services', () => ({
  getActivityService: () => ({
    getActivityById: (...args: unknown[]) => mockGetActivityById(...args),
  }),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import { handleTempRoleUpdate } from '../../bot/interactions/eventButtons.tempRoles';

function makeInteraction(guild?: unknown): { guild: unknown } {
  return { guild: guild === undefined ? { id: 'guild-1' } : guild };
}

describe('eventButtons temp-role cluster (Slice 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActivityById.mockResolvedValue({ metadata: { tempRoleId: 'role-1' } });
    mockAssignTempRole.mockResolvedValue(undefined);
    mockRemoveTempRole.mockResolvedValue(undefined);
  });

  it('returns early when no guild is available', async () => {
    handleTempRoleUpdate(makeInteraction(null) as never, 'activity-1', 'user-1', 'join');

    await Promise.resolve();

    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(mockAssignTempRole).not.toHaveBeenCalled();
    expect(mockRemoveTempRole).not.toHaveBeenCalled();
  });

  it('returns early for non-RSVP actions', async () => {
    handleTempRoleUpdate(makeInteraction() as never, 'activity-1', 'user-1', 'tentative');

    await Promise.resolve();

    expect(mockGetActivityById).not.toHaveBeenCalled();
    expect(mockAssignTempRole).not.toHaveBeenCalled();
    expect(mockRemoveTempRole).not.toHaveBeenCalled();
  });

  it('assigns the temp role on join', async () => {
    handleTempRoleUpdate(makeInteraction() as never, 'activity-1', 'user-1', 'join');

    await Promise.resolve();
    await Promise.resolve();

    expect(mockGetActivityById).toHaveBeenCalledWith('activity-1');
    expect(mockAssignTempRole).toHaveBeenCalledWith(
      { id: 'guild-1' },
      'user-1',
      'role-1',
      'activity-1'
    );
    expect(mockRemoveTempRole).not.toHaveBeenCalled();
  });

  it.each(['leave', 'decline'])('removes the temp role on %s', async action => {
    handleTempRoleUpdate(makeInteraction() as never, 'activity-1', 'user-1', action);

    await Promise.resolve();
    await Promise.resolve();

    expect(mockGetActivityById).toHaveBeenCalledWith('activity-1');
    expect(mockRemoveTempRole).toHaveBeenCalledWith(
      { id: 'guild-1' },
      'user-1',
      'role-1',
      'activity-1'
    );
    expect(mockAssignTempRole).not.toHaveBeenCalled();
  });

  it('skips when the activity has no tempRoleId', async () => {
    mockGetActivityById.mockResolvedValueOnce({ metadata: {} });

    handleTempRoleUpdate(makeInteraction() as never, 'activity-1', 'user-1', 'join');

    await Promise.resolve();
    await Promise.resolve();

    expect(mockAssignTempRole).not.toHaveBeenCalled();
    expect(mockRemoveTempRole).not.toHaveBeenCalled();
  });

  it('swallows service rejection', async () => {
    mockAssignTempRole.mockRejectedValueOnce(new Error('boom'));

    handleTempRoleUpdate(makeInteraction() as never, 'activity-1', 'user-1', 'join');

    await Promise.resolve();
    await Promise.resolve();

    expect(mockAssignTempRole).toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
