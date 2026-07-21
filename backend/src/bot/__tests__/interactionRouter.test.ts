jest.mock('../../config/applicationInsights', () => ({
  trackEvent: jest.fn(),
  trackMetric: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from '../../utils/logger';
import type { BotCommand } from '../commands/types';
import { routeInteraction } from '../interactionRouter';
import { CooldownManager } from '../utils/cooldownManager';

const PANEL_ONLY_PREFIXES = [
  'guild',
  'faq',
  'wiki',
  'help',
  'readycheck',
  'rsistatus',
  'rsisync',
] as const;

type InteractionKind = 'button' | 'modal' | 'select' | 'channelselect' | 'other';

type MockInteraction = {
  customId: string;
  user: { id: string; username: string };
  guildId: string | null;
  guild: { name: string };
  replied: boolean;
  deferred: boolean;
  reply: jest.Mock<Promise<void>, [unknown]>;
  followUp: jest.Mock<Promise<void>, [unknown]>;
  isButton: () => boolean;
  isModalSubmit: () => boolean;
  isStringSelectMenu: () => boolean;
  isChannelSelectMenu: () => boolean;
};

function createInteraction(kind: InteractionKind, customId: string): MockInteraction {
  return {
    customId,
    user: { id: 'discord-user-1', username: 'Pilot' },
    guildId: 'guild-1',
    guild: { name: 'Test Guild' },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    isButton: () => kind === 'button',
    isModalSubmit: () => kind === 'modal',
    isStringSelectMenu: () => kind === 'select',
    isChannelSelectMenu: () => kind === 'channelselect',
  };
}

function createClientWithCommand(commandName: string, command: BotCommand) {
  return {
    commands: new Map<string, BotCommand>([[commandName, command]]),
  };
}

function createCommand(
  name: string,
  handlers: Partial<
    Pick<
      BotCommand,
      'handleButton' | 'handleModal' | 'handleSelectMenu' | 'handleChannelSelectMenu'
    >
  >
): BotCommand {
  return {
    data: { name } as unknown as BotCommand['data'],
    execute: jest.fn(async () => undefined),
    ...handlers,
  };
}

function clearRouterCooldowns(manager: CooldownManager): void {
  manager.clearUserCooldowns('discord-user-1');
}

describe('interactionRouter panel-only prefix routing', () => {
  const cooldownManager = CooldownManager.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
    clearRouterCooldowns(cooldownManager);
  });

  it.each(PANEL_ONLY_PREFIXES)('routes %s button customIds to handleButton', async prefix => {
    const handleButton = jest.fn(async () => undefined);
    const command = createCommand(prefix, { handleButton });
    const client = createClientWithCommand(prefix, command);
    const interaction = createInteraction('button', `${prefix}_panel_status`);

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(handleButton).toHaveBeenCalledTimes(1);
    expect(handleButton).toHaveBeenCalledWith(interaction);
  });

  it.each(PANEL_ONLY_PREFIXES)('routes %s modal customIds to handleModal', async prefix => {
    const handleModal = jest.fn(async () => undefined);
    const command = createCommand(prefix, { handleModal });
    const client = createClientWithCommand(prefix, command);
    const interaction = createInteraction('modal', `${prefix}_setup_modal`);

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(handleModal).toHaveBeenCalledTimes(1);
    expect(handleModal).toHaveBeenCalledWith(interaction);
  });

  it.each(PANEL_ONLY_PREFIXES)(
    'routes %s select-menu customIds to handleSelectMenu',
    async prefix => {
      const handleSelectMenu = jest.fn(async () => undefined);
      const command = createCommand(prefix, { handleSelectMenu });
      const client = createClientWithCommand(prefix, command);
      const interaction = createInteraction('select', `${prefix}_settings_category`);

      const handled = await routeInteraction(
        interaction as never,
        client as never,
        cooldownManager,
        undefined
      );

      expect(handled).toBe(true);
      expect(handleSelectMenu).toHaveBeenCalledTimes(1);
      expect(handleSelectMenu).toHaveBeenCalledWith(interaction);
    }
  );

  it.each(PANEL_ONLY_PREFIXES)(
    'routes %s channel-select customIds to handleChannelSelectMenu',
    async prefix => {
      const handleChannelSelectMenu = jest.fn(async () => undefined);
      const command = createCommand(prefix, { handleChannelSelectMenu });
      const client = createClientWithCommand(prefix, command);
      const interaction = createInteraction('channelselect', `${prefix}_chanpick_application`);

      const handled = await routeInteraction(
        interaction as never,
        client as never,
        cooldownManager,
        undefined
      );

      expect(handled).toBe(true);
      expect(handleChannelSelectMenu).toHaveBeenCalledTimes(1);
      expect(handleChannelSelectMenu).toHaveBeenCalledWith(interaction);
    }
  );

  it('rejects repeated button interactions during cooldown window', async () => {
    const handleButton = jest.fn(async () => undefined);
    const command = createCommand('faq', { handleButton });
    const client = createClientWithCommand('faq', command);
    const first = createInteraction('button', 'faq_panel_list');
    const second = createInteraction('button', 'faq_panel_list');

    await routeInteraction(first as never, client as never, cooldownManager);
    await routeInteraction(second as never, client as never, cooldownManager);

    expect(handleButton).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Please wait'),
        flags: expect.any(Number),
      })
    );
    expect(second.followUp).not.toHaveBeenCalled();
  });

  it('allows consecutive button interactions for different actions', async () => {
    const handleButton = jest.fn(async () => undefined);
    const command = createCommand('events', { handleButton });
    const client = createClientWithCommand('events', command);
    const first = createInteraction('button', 'event_join_abc123');
    const second = createInteraction('button', 'event_leave_abc123');

    await routeInteraction(first as never, client as never, cooldownManager);
    await routeInteraction(second as never, client as never, cooldownManager);

    expect(handleButton).toHaveBeenCalledTimes(2);
    expect(second.reply).not.toHaveBeenCalled();
  });

  it('rejects repeated modal interactions during cooldown window', async () => {
    const handleModal = jest.fn(async () => undefined);
    const command = createCommand('wiki', { handleModal });
    const client = createClientWithCommand('wiki', command);
    const first = createInteraction('modal', 'wiki_search_modal');
    const second = createInteraction('modal', 'wiki_search_modal');

    await routeInteraction(first as never, client as never, cooldownManager, undefined);
    await routeInteraction(second as never, client as never, cooldownManager, undefined);

    expect(handleModal).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Please wait'),
        flags: expect.any(Number),
      })
    );
  });

  it('rejects repeated select-menu interactions during cooldown window', async () => {
    const handleSelectMenu = jest.fn(async () => undefined);
    const command = createCommand('guild', { handleSelectMenu });
    const client = createClientWithCommand('guild', command);
    const first = createInteraction('select', 'guild_settings_category');
    const second = createInteraction('select', 'guild_settings_category');

    await routeInteraction(first as never, client as never, cooldownManager, undefined);
    await routeInteraction(second as never, client as never, cooldownManager, undefined);

    expect(handleSelectMenu).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Please wait'),
        flags: expect.any(Number),
      })
    );
  });

  it('rejects repeated channel-select interactions during cooldown window', async () => {
    const handleChannelSelectMenu = jest.fn(async () => undefined);
    const command = createCommand('rsistatus', { handleChannelSelectMenu });
    const client = createClientWithCommand('rsistatus', command);
    const first = createInteraction('channelselect', 'rsistatus_chanpick_application');
    const second = createInteraction('channelselect', 'rsistatus_chanpick_application');

    await routeInteraction(first as never, client as never, cooldownManager, undefined);
    await routeInteraction(second as never, client as never, cooldownManager, undefined);

    expect(handleChannelSelectMenu).toHaveBeenCalledTimes(1);
    expect(second.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Please wait'),
        flags: expect.any(Number),
      })
    );
  });

  it('uses followUp on button handler error when interaction is deferred', async () => {
    const handleButton = jest.fn(async () => {
      throw new Error('boom');
    });
    const command = createCommand('help', { handleButton });
    const client = createClientWithCommand('help', command);
    const interaction = createInteraction('button', 'help_panel_faq');
    interaction.deferred = true;

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Something went wrong'),
        flags: expect.any(Number),
      })
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('uses followUp on modal handler error when interaction is already replied', async () => {
    const handleModal = jest.fn(async () => {
      throw new Error('modal failure');
    });
    const command = createCommand('wiki', { handleModal });
    const client = createClientWithCommand('wiki', command);
    const interaction = createInteraction('modal', 'wiki_search_modal');
    interaction.replied = true;

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Something went wrong processing that form'),
        flags: expect.any(Number),
      })
    );
  });

  it('uses followUp on select-menu handler error when interaction is deferred', async () => {
    const handleSelectMenu = jest.fn(async () => {
      throw new Error('select failure');
    });
    const command = createCommand('guild', { handleSelectMenu });
    const client = createClientWithCommand('guild', command);
    const interaction = createInteraction('select', 'guild_settings_category');
    interaction.deferred = true;

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Something went wrong processing that selection'),
        flags: expect.any(Number),
      })
    );
  });

  it('returns true for button interactions even when prefix is unmapped', async () => {
    const client = { commands: new Map<string, BotCommand>() };
    const interaction = createInteraction('button', 'unknown_panel_status');

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No command handler found for button customId')
    );
  });

  it('warns when mapped command has no button handler', async () => {
    const command = createCommand('faq', {});
    const client = createClientWithCommand('faq', command);
    const interaction = createInteraction('button', 'faq_panel_list');

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('has no handleButton method'));
  });

  it('returns false for non-button/modal/select interactions', async () => {
    const client = { commands: new Map<string, BotCommand>() };
    const interaction = createInteraction('other', 'ignored_custom_id');

    const handled = await routeInteraction(
      interaction as never,
      client as never,
      cooldownManager,
      undefined
    );

    expect(handled).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
