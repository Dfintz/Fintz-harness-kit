import type { ButtonInteraction } from 'discord.js';

import { rsisync } from '../commands/rsisync';
import { handleRsiSyncAdminAction } from '../commands/shared/rsiSyncAdminActions';
import { verify } from '../commands/verify';

jest.mock('../commands/shared/rsiSyncAdminActions', () => ({
  handleRsiSyncAdminAction: jest.fn().mockResolvedValue(undefined),
  isRsiSyncAdminAction: (value: string) => ['status', 'setup', 'run', 'audit'].includes(value),
  resolveOrgIdFromGuild: jest.fn().mockResolvedValue('org-1'),
}));

const mockHandleRsiSyncAdminAction = handleRsiSyncAdminAction as jest.MockedFunction<
  typeof handleRsiSyncAdminAction
>;

function createButtonInteraction(customId: string): ButtonInteraction {
  return {
    customId,
    guildId: 'guild-1',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
  } as unknown as ButtonInteraction;
}

describe('verify and rsisync admin action parity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes verify status button through shared RSI sync admin action handler', async () => {
    const interaction = createButtonInteraction('verify_panel_status');

    await verify.handleButton?.(interaction);

    expect(mockHandleRsiSyncAdminAction).toHaveBeenCalledWith('status', interaction);
  });

  it('keeps verify link button behavior without calling shared admin action handler', async () => {
    const interaction = createButtonInteraction('verify_panel_link');

    await verify.handleButton?.(interaction);

    expect(interaction.showModal).toHaveBeenCalledTimes(1);
    expect(mockHandleRsiSyncAdminAction).not.toHaveBeenCalled();
  });

  it('routes rsisync run button through shared RSI sync admin action handler', async () => {
    const interaction = createButtonInteraction('rsisync_panel_run');

    await rsisync.handleButton?.(interaction);

    expect(mockHandleRsiSyncAdminAction).toHaveBeenCalledWith('run', interaction);
  });

  it('ignores unknown rsisync subcommands', async () => {
    const interaction = createButtonInteraction('rsisync_panel_unknown');

    await rsisync.handleButton?.(interaction);

    expect(mockHandleRsiSyncAdminAction).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
