const mockPreJoinChecks = jest.fn();
const mockHandleRSVPAction = jest.fn();
const mockLeaveActivity = jest.fn();
const mockLeaveShipCrew = jest.fn();
const mockLeaveShipAsPassenger = jest.fn();

jest.mock('../eventButtons.preJoinChecks', () => ({
  preJoinChecks: (...args: unknown[]) => mockPreJoinChecks(...args),
}));

jest.mock('../eventButtons.rsvp', () => ({
  RSVP_ACTIONS: { join: 'accepted', tentative: 'tentative', decline: 'declined' },
  handleRSVPAction: (...args: unknown[]) => mockHandleRSVPAction(...args),
}));

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    leaveActivity: (...args: unknown[]) => mockLeaveActivity(...args),
    leaveShipCrew: (...args: unknown[]) => mockLeaveShipCrew(...args),
    leaveShipAsPassenger: (...args: unknown[]) => mockLeaveShipAsPassenger(...args),
  })),
}));

import { executeNonDirectAction } from '../eventButtons.nonDirectActions';

describe('eventButtons.nonDirectActions seam', () => {
  const interaction = {
    user: { id: 'discord-user-1', username: 'Pilot' },
    followUp: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPreJoinChecks.mockResolvedValue({ allowed: true });
    mockHandleRSVPAction.mockResolvedValue(undefined);
    mockLeaveActivity.mockResolvedValue(undefined);
    mockLeaveShipCrew.mockResolvedValue(undefined);
    mockLeaveShipAsPassenger.mockResolvedValue(undefined);
  });

  it('returns false and sends ephemeral follow-up when pre-join checks block', async () => {
    mockPreJoinChecks.mockResolvedValueOnce({ allowed: false, reason: 'Blocked' });

    const result = await executeNonDirectAction({
      interaction: interaction as never,
      action: 'join',
      activityId: 'activity-1',
      userId: 'internal-1',
      userName: 'Pilot',
      isDiscordGuest: false,
      guestContext: null,
    });

    expect(result).toBe(false);
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'Blocked',
      flags: expect.any(Number),
    });
    expect(mockHandleRSVPAction).not.toHaveBeenCalled();
  });

  it('calls RSVP handler with guest metadata for guest RSVP actions', async () => {
    const result = await executeNonDirectAction({
      interaction: interaction as never,
      action: 'tentative',
      activityId: 'activity-1',
      userId: 'guest-uuid',
      userName: 'Pilot',
      isDiscordGuest: true,
      guestContext: { guestId: 'guest-uuid', guestMemberRoleIds: [], advancedEventSettings: {} },
    });

    expect(result).toBe(true);
    expect(mockHandleRSVPAction).toHaveBeenCalledWith(
      'activity-1',
      'guest-uuid',
      'Pilot',
      'tentative',
      { discordGuest: true, discordId: 'discord-user-1' }
    );
  });

  it('executes leave action handlers', async () => {
    await expect(
      executeNonDirectAction({
        interaction: interaction as never,
        action: 'leave',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        guestContext: null,
      })
    ).resolves.toBe(true);

    await expect(
      executeNonDirectAction({
        interaction: interaction as never,
        action: 'leavecrew',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        guestContext: null,
      })
    ).resolves.toBe(true);

    await expect(
      executeNonDirectAction({
        interaction: interaction as never,
        action: 'leavepassenger',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        guestContext: null,
      })
    ).resolves.toBe(true);

    expect(mockLeaveActivity).toHaveBeenCalledWith('activity-1', 'internal-1');
    expect(mockLeaveShipCrew).toHaveBeenCalledWith('activity-1', 'internal-1');
    expect(mockLeaveShipAsPassenger).toHaveBeenCalledWith('activity-1', 'internal-1');
  });

  it('returns true and performs no calls for non-matching action', async () => {
    const result = await executeNonDirectAction({
      interaction: interaction as never,
      action: 'noop',
      activityId: 'activity-1',
      userId: 'internal-1',
      userName: 'Pilot',
      isDiscordGuest: false,
      guestContext: null,
    });

    expect(result).toBe(true);
    expect(mockPreJoinChecks).not.toHaveBeenCalled();
    expect(mockHandleRSVPAction).not.toHaveBeenCalled();
    expect(mockLeaveActivity).not.toHaveBeenCalled();
    expect(mockLeaveShipCrew).not.toHaveBeenCalled();
    expect(mockLeaveShipAsPassenger).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
