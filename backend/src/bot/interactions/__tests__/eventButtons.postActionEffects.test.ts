const mockHandleTempRoleUpdate = jest.fn();
const mockRefreshEventEmbed = jest.fn();
const mockRefreshEventEmbedFromChannel = jest.fn();
const mockGetEphemeralLeaveConfirmation = jest.fn();
const mockTriggerMirrorSync = jest.fn();
const mockLogAuditEvent = jest.fn();

jest.mock('../eventButtons.tempRoles', () => ({
  handleTempRoleUpdate: (...args: unknown[]) => mockHandleTempRoleUpdate(...args),
}));

jest.mock('../eventButtons.refresh', () => ({
  refreshEventEmbed: (...args: unknown[]) => mockRefreshEventEmbed(...args),
  refreshEventEmbedFromChannel: (...args: unknown[]) => mockRefreshEventEmbedFromChannel(...args),
}));

jest.mock('../eventButtons.directActions', () => ({
  getEphemeralLeaveConfirmation: (...args: unknown[]) => mockGetEphemeralLeaveConfirmation(...args),
}));

jest.mock('../eventButtons.mirrorSync', () => ({
  triggerMirrorSync: (...args: unknown[]) => mockTriggerMirrorSync(...args),
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: {
    ACTIVITY_ACTION: 'ACTIVITY_ACTION',
  },
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

import { runPostActionEffects } from '../eventButtons.postActionEffects';

describe('eventButtons.postActionEffects seam', () => {
  const interaction = {
    guildId: 'guild-1',
    channelId: 'channel-1',
    editReply: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshEventEmbed.mockResolvedValue(undefined);
    mockRefreshEventEmbedFromChannel.mockResolvedValue(undefined);
    mockGetEphemeralLeaveConfirmation.mockReturnValue('✅ Done.');
    interaction.editReply.mockResolvedValue(undefined);
  });

  it('runs non-guest non-ephemeral side effects in order', async () => {
    await runPostActionEffects({
      interaction: interaction as never,
      action: 'join',
      activityId: 'activity-1',
      userId: 'internal-1',
      userName: 'Pilot',
      isDiscordGuest: false,
      isEphemeralSource: false,
    });

    expect(mockHandleTempRoleUpdate).toHaveBeenCalledWith(
      interaction,
      'activity-1',
      'internal-1',
      'join'
    );
    expect(mockRefreshEventEmbed).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(mockRefreshEventEmbedFromChannel).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
    expect(mockTriggerMirrorSync).toHaveBeenCalledWith('activity-1', 'internal-1', 'Pilot', 'join');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ACTIVITY_ACTION',
        action: 'EVENT_JOIN',
        resource: 'discord/guild/guild-1/channel/channel-1',
        metadata: {
          activityId: 'activity-1',
          action: 'join',
          isDiscordGuest: false,
        },
      })
    );
  });

  it('guest path skips temp-role but still runs refresh, mirror, and audit', async () => {
    await runPostActionEffects({
      interaction: interaction as never,
      action: 'tentative',
      activityId: 'activity-1',
      userId: 'guest-uuid',
      userName: 'Pilot',
      isDiscordGuest: true,
      isEphemeralSource: false,
    });

    expect(mockHandleTempRoleUpdate).not.toHaveBeenCalled();
    expect(mockRefreshEventEmbed).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(mockTriggerMirrorSync).toHaveBeenCalledWith(
      'activity-1',
      'guest-uuid',
      'Pilot',
      'tentative'
    );
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EVENT_TENTATIVE',
        metadata: {
          activityId: 'activity-1',
          action: 'tentative',
          isDiscordGuest: true,
        },
      })
    );
  });

  it('ephemeral source path refreshes via channel and collapses panel', async () => {
    await runPostActionEffects({
      interaction: interaction as never,
      action: 'leavecrew',
      activityId: 'activity-1',
      userId: 'internal-1',
      userName: 'Pilot',
      isDiscordGuest: false,
      isEphemeralSource: true,
    });

    expect(mockRefreshEventEmbedFromChannel).toHaveBeenCalledWith(interaction, 'activity-1');
    expect(mockGetEphemeralLeaveConfirmation).toHaveBeenCalledWith('leavecrew');
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '✅ Done.',
      components: [],
    });
    expect(mockRefreshEventEmbed).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
