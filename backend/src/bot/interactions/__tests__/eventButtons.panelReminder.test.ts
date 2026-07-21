import { MessageFlags } from 'discord.js';

const mockBuildEventActionPanelComponents = jest.fn();
const mockGetActivityById = jest.fn();
const mockGetActivityReminders = jest.fn();
const mockCreateActivityReminders = jest.fn();
const mockPickReminderOffset = jest.fn();

jest.mock('../../embeds/eventEmbed', () => ({
  buildEventActionPanelComponents: (...args: unknown[]) =>
    mockBuildEventActionPanelComponents(...args),
}));

jest.mock('../eventButtons.services', () => ({
  getActivityService: jest.fn(() => ({
    getActivityById: mockGetActivityById,
  })),
  getReminderService: jest.fn(() => ({
    getActivityReminders: mockGetActivityReminders,
    createActivityReminders: mockCreateActivityReminders,
  })),
}));

jest.mock('../eventReminderOffset', () => ({
  pickReminderOffset: (...args: unknown[]) => mockPickReminderOffset(...args),
}));

import {
  ephemeralLeaveConfirmation,
  handleOpenActionsPanel,
  handleRemindMe,
} from '../eventButtons.panelReminder';

describe('eventButtons.panelReminder seam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildEventActionPanelComponents.mockReturnValue([{ id: 'row-1' }, { id: 'row-2' }]);
  });

  it('opens actions panel as ephemeral with 2 component rows', async () => {
    const interaction = createButtonInteraction();

    await handleOpenActionsPanel(interaction as never, 'activity-1');

    expect(mockBuildEventActionPanelComponents).toHaveBeenCalledWith('activity-1');
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '🚀 **Ship & Crew** — choose an action:',
      components: [{ id: 'row-1' }, { id: 'row-2' }],
      flags: MessageFlags.Ephemeral,
    });
  });

  it('remindme handles stale/no-schedule/too-soon guards', async () => {
    const stale = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce(null);
    await handleRemindMe(stale as never, 'activity-1');
    expect(stale.editReply).toHaveBeenCalledWith({ content: '⚠️ Activity no longer exists.' });

    const noSchedule = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({ id: 'activity-1', title: 'Op' });
    await handleRemindMe(noSchedule as never, 'activity-1');
    expect(noSchedule.editReply).toHaveBeenCalledWith({
      content: '⚠️ This event has no scheduled time, so a reminder cannot be set.',
    });

    const tooSoon = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      title: 'Op',
      scheduledStartDate: '2026-07-01T12:00:00.000Z',
    });
    mockPickReminderOffset.mockReturnValueOnce(null);
    await handleRemindMe(tooSoon as never, 'activity-1');
    expect(tooSoon.editReply).toHaveBeenCalledWith({
      content: '⏰ This event is too soon to set a reminder.',
    });
  });

  it('remindme dedupes existing pending reminder', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      title: 'Op',
      scheduledStartDate: '2026-07-01T12:00:00.000Z',
    });
    mockPickReminderOffset.mockReturnValueOnce({
      type: 'one_hour_before',
      label: '1 hour before',
      fireAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    mockGetActivityReminders.mockResolvedValueOnce([
      {
        recipientUserIds: ['discord-user-1'],
        scheduledTime: '2030-01-01T00:00:00.000Z',
      },
    ]);

    await handleRemindMe(interaction as never, 'activity-1');

    expect(mockCreateActivityReminders).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '🔔 You already have a reminder set for this event.',
    });
  });

  it('remindme continues when dedupe lookup fails and creates reminder', async () => {
    const interaction = createButtonInteraction();
    mockGetActivityById.mockResolvedValueOnce({
      id: 'activity-1',
      title: 'Op',
      scheduledStartDate: '2026-07-01T12:00:00.000Z',
    });
    mockPickReminderOffset.mockReturnValueOnce({
      type: 'one_day_before',
      label: '1 day before',
      fireAt: new Date('2030-01-02T03:04:05.000Z'),
    });
    mockGetActivityReminders.mockRejectedValueOnce(new Error('lookup failed'));

    await handleRemindMe(interaction as never, 'activity-1');

    expect(mockCreateActivityReminders).toHaveBeenCalledWith(
      'activity-1',
      ['one_day_before'],
      'discord',
      ['discord-user-1']
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("You'll be reminded **1 day before**"),
      })
    );
  });

  it('maps ephemeral leave confirmation text correctly', () => {
    expect(ephemeralLeaveConfirmation('leavecrew')).toBe('✅ You left the ship crew.');
    expect(ephemeralLeaveConfirmation('leavepassenger')).toBe('✅ You left your passenger seat.');
    expect(ephemeralLeaveConfirmation('leave')).toBe('✅ Done.');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

function createButtonInteraction(): {
  user: { id: string; username: string };
  reply: jest.Mock;
  deferReply: jest.Mock;
  editReply: jest.Mock;
} {
  return {
    user: { id: 'discord-user-1', username: 'Pilot' },
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
  };
}
