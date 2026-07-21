const mockExecuteNonDirectAction = jest.fn();
const mockRunPostActionEffects = jest.fn();

jest.mock('../eventButtons.nonDirectActions', () => ({
  executeNonDirectAction: (...args: unknown[]) => mockExecuteNonDirectAction(...args),
}));

jest.mock('../eventButtons.postActionEffects', () => ({
  runPostActionEffects: (...args: unknown[]) => mockRunPostActionEffects(...args),
}));

import { runDeferredNonDirectPipeline } from '../eventButtons.nonDirectPipeline';

describe('eventButtons.nonDirectPipeline seam', () => {
  const interaction = {
    user: { id: 'discord-user-1', username: 'Pilot' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteNonDirectAction.mockResolvedValue(true);
    mockRunPostActionEffects.mockResolvedValue(undefined);
  });

  it('forwards isEphemeralSource to post-action effects', async () => {
    await runDeferredNonDirectPipeline({
      interaction: interaction as never,
      action: 'join',
      activityId: 'activity-1',
      userId: 'internal-1',
      userName: 'Pilot',
      isDiscordGuest: false,
      guestContext: null,
      isEphemeralSource: true,
    });

    expect(mockExecuteNonDirectAction).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        action: 'join',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        guestContext: null,
      })
    );
    expect(mockRunPostActionEffects).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction,
        action: 'join',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        isEphemeralSource: true,
      })
    );
  });

  it('returns early when non-direct execution short-circuits', async () => {
    mockExecuteNonDirectAction.mockResolvedValueOnce(false);

    await runDeferredNonDirectPipeline({
      interaction: interaction as never,
      action: 'join',
      activityId: 'activity-1',
      userId: 'internal-1',
      userName: 'Pilot',
      isDiscordGuest: false,
      guestContext: null,
      isEphemeralSource: false,
    });

    expect(mockRunPostActionEffects).not.toHaveBeenCalled();
  });

  it('propagates errors from executeNonDirectAction', async () => {
    mockExecuteNonDirectAction.mockRejectedValueOnce(new Error('exec-failed'));

    await expect(
      runDeferredNonDirectPipeline({
        interaction: interaction as never,
        action: 'join',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        guestContext: null,
        isEphemeralSource: false,
      })
    ).rejects.toThrow('exec-failed');
  });

  it('propagates errors from runPostActionEffects', async () => {
    mockRunPostActionEffects.mockRejectedValueOnce(new Error('post-failed'));

    await expect(
      runDeferredNonDirectPipeline({
        interaction: interaction as never,
        action: 'join',
        activityId: 'activity-1',
        userId: 'internal-1',
        userName: 'Pilot',
        isDiscordGuest: false,
        guestContext: null,
        isEphemeralSource: false,
      })
    ).rejects.toThrow('post-failed');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
