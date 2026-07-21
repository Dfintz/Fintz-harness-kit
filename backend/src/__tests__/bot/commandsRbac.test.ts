/**
 * RBAC gate tests for admin-only Discord bot commands.
 *
 * Verifies that platform-admin gates added in PR6 (expansion) correctly
 * deny non-admins and allow admins through, without invoking destructive
 * service code paths.
 */

import {
  __clearPlatformRbacCacheForTesting,
  __setUserServiceFactoryForTesting,
} from '../../bot/utils/platformRbac';

type FakeUser = { id: string; role: string } | null;

function makeUserService(role: string | null) {
  const impl = async (): Promise<FakeUser> => (role === null ? null : { id: 'u1', role });
  return {
    getUserByDiscordId: jest.fn(impl),
  } as unknown as import('../../services/user/UserService').UserService;
}

function setRole(role: string | null) {
  const svc = makeUserService(role);
  __setUserServiceFactoryForTesting(() => svc);
}

interface FakeInteraction {
  user: { id: string };
  guildId: string | null;
  customId?: string;
  client?: { ws: { ping: number } };
  replied: boolean;
  deferred: boolean;
  reply: jest.Mock;
  followUp: jest.Mock;
  deferReply: jest.Mock;
  editReply: jest.Mock;
  showModal: jest.Mock;
  options?: {
    getString: jest.Mock;
    getInteger: jest.Mock;
  };
  fields?: {
    getTextInputValue: jest.Mock;
  };
  values?: string[];
  channel?: { send: jest.Mock };
  guild?: { name: string };
  memberPermissions?: { has: jest.Mock };
}

function makeInteraction(overrides: Partial<FakeInteraction> = {}): FakeInteraction {
  return {
    user: { id: 'discord-user-1' },
    guildId: 'guild-1',
    client: { ws: { ping: 42 } },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    channel: { send: jest.fn().mockResolvedValue(undefined) },
    guild: { name: 'Test Guild' },
    ...overrides,
  };
}

type AnyInteractionHandler = (i: never) => unknown;

/**
 * Invoke a Discord bot command handler with a fake interaction. The `never`
 * parameter type makes any handler signature assignable, letting tests stay
 * free of per-call `as never` casts while still routing the FakeInteraction
 * through the production handler.
 */
async function invoke(
  handler: AnyInteractionHandler | undefined,
  interaction: FakeInteraction
): Promise<void> {
  if (!handler) throw new Error('handler is undefined');
  await (handler as (i: FakeInteraction) => unknown)(interaction);
}

describe('Admin command RBAC gates', () => {
  afterEach(() => {
    __clearPlatformRbacCacheForTesting();
    jest.restoreAllMocks();
  });

  describe('/analytics', () => {
    it('executes analytics without platform-admin denial in current implementation', async () => {
      setRole('user');
      const { analytics } = await import('../../bot/commands/analytics');
      const interaction = makeInteraction();

      await invoke(analytics.execute, interaction);

      // Defer-first (C3): the command declares ephemeral deferral, which the
      // shared interaction executor performs before execute() runs — execute()
      // itself only editReplies. Assert the declarative defer contract rather
      // than expecting execute() to self-defer.
      expect(analytics.defer).toBe('ephemeral');
      expect(interaction.editReply).toHaveBeenCalledTimes(1);

      const denialReplies = interaction.reply.mock.calls.filter(call =>
        String((call[0] as { content?: string }).content).includes('platform administrator')
      );
      expect(denialReplies.length).toBe(0);
    });
  });

  describe('/federation buttons', () => {
    const adminSubs: Array<['unlink' | 'sync_roles' | 'configure', string]> = [
      ['unlink', 'federation_panel_unlink'],
      ['sync_roles', 'federation_panel_sync_roles'],
      ['configure', 'federation_panel_configure'],
    ];

    it.each(adminSubs)(
      'denies non-admin for %s button without invoking handler',
      async (_sub, customId) => {
        setRole('user');
        const { federation } = await import('../../bot/commands/federation');
        const interaction = makeInteraction({ customId });

        await invoke(federation.handleButton, interaction);

        expect(interaction.reply).toHaveBeenCalledTimes(1);
        const replyArg = interaction.reply.mock.calls[0][0];
        expect(String(replyArg.content)).toContain('platform administrator');
        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(interaction.showModal).not.toHaveBeenCalled();
      }
    );

    it('denies non-admin for setup button (does not show modal)', async () => {
      setRole('user');
      const { federation } = await import('../../bot/commands/federation');
      const interaction = makeInteraction({ customId: 'federation_panel_setup' });

      await invoke(federation.handleButton, interaction);

      expect(interaction.showModal).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('platform administrator');
    });

    it('does not gate non-admin status button (read-only)', async () => {
      setRole('user');
      const { federation } = await import('../../bot/commands/federation');
      const interaction = makeInteraction({ customId: 'federation_panel_status' });

      await invoke(federation.handleButton, interaction);

      // No platform-admin denial reply should have been issued.
      const denialReplies = interaction.reply.mock.calls.filter(call =>
        String((call[0] as { content?: string }).content).includes('platform administrator')
      );
      expect(denialReplies.length).toBe(0);
    });
  });

  describe('/federation handleModal', () => {
    it('denies non-admin for federation_setup_modal', async () => {
      setRole('user');
      const { federation } = await import('../../bot/commands/federation');
      const interaction = makeInteraction({
        customId: 'federation_setup_modal',
        fields: {
          getTextInputValue: jest.fn(() => 'fed-id'),
        },
      });

      await invoke(federation.handleModal, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('platform administrator');
    });
  });

  describe('/moderation buttons', () => {
    it('denies non-admin for mirror button', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({ customId: 'moderation_panel_mirror' });

      await invoke(moderation.handleButton, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('platform administrator');
    });

    it('denies non-admin for revoke button', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({ customId: 'moderation_panel_revoke' });

      await invoke(moderation.handleButton, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
    });

    it('does not gate non-admin for read-only stats button', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({ customId: 'moderation_panel_stats' });

      // Even though the underlying handler may fail without service mocks, we
      // assert no platform-admin denial reply was issued.
      try {
        await invoke(moderation.handleButton, interaction);
      } catch {
        /* underlying service unmocked — irrelevant to gate */
      }

      const denialReplies = interaction.reply.mock.calls.filter(call =>
        String((call[0] as { content?: string }).content).includes('platform administrator')
      );
      expect(denialReplies.length).toBe(0);
    });
  });

  describe('/moderation handleSelectMenu', () => {
    it('denies non-admin for mirror_select', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({
        customId: 'moderation_mirror_select',
        values: ['incident-1'],
      });

      await invoke(moderation.handleSelectMenu, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('platform administrator');
    });

    it('denies non-admin for revoke_select', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({
        customId: 'moderation_revoke_select',
        values: ['incident-1'],
      });

      await invoke(moderation.handleSelectMenu, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
    });
  });

  describe('/moderation handleModal', () => {
    it('denies non-admin for mirror_modal', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({
        customId: 'moderation_mirror_modal',
        fields: {
          getTextInputValue: jest.fn(() => 'incident-1'),
        },
      });

      await invoke(moderation.handleModal, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('platform administrator');
    });

    it('denies non-admin for revoke_modal', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({
        customId: 'moderation_revoke_modal',
        fields: {
          getTextInputValue: jest.fn(() => 'incident-1'),
        },
      });

      await invoke(moderation.handleModal, interaction);

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
    });

    it('does not gate non-admin for non-admin modal (lookup)', async () => {
      setRole('user');
      const { moderation } = await import('../../bot/commands/moderation');
      const interaction = makeInteraction({
        customId: 'moderation_lookup_modal',
        fields: {
          getTextInputValue: jest.fn(() => '123456789012345678'),
        },
      });

      try {
        await invoke(moderation.handleModal, interaction);
      } catch {
        /* service unmocked — irrelevant */
      }

      const denialReplies = interaction.reply.mock.calls.filter(call =>
        String((call[0] as { content?: string }).content).includes('platform administrator')
      );
      expect(denialReplies.length).toBe(0);
    });
  });

  describe('/notify buttons (guild-permission gate)', () => {
    it('denies a non-admin guild DM toggle without opening the toggle UI', async () => {
      const { notify } = await import('../../bot/commands/notify');
      const interaction = makeInteraction({
        customId: 'notify_panel_dm_toggle',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      });

      await invoke(notify.handleButton, interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('Manage Server');
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('denies a non-admin lfg_mention modal trigger', async () => {
      const { notify } = await import('../../bot/commands/notify');
      const interaction = makeInteraction({
        customId: 'notify_panel_lfg_mention',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      });

      await invoke(notify.handleButton, interaction);

      expect(interaction.showModal).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledTimes(1);
      expect(String(interaction.reply.mock.calls[0][0].content)).toContain('Manage Server');
    });

    it('allows a personal preference toggle for a non-admin', async () => {
      const { notify } = await import('../../bot/commands/notify');
      const interaction = makeInteraction({
        customId: 'notify_panel_my_toggle',
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      });

      await invoke(notify.handleButton, interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const replyArg = interaction.reply.mock.calls[0][0];
      expect(String(replyArg.content)).toContain('personal notification preference');
      expect(String(replyArg.content)).not.toContain('Manage Server');
    });
  });

  describe('/notify select & modal (guild-permission gate)', () => {
    it('denies a non-admin guild DM-toggle select', async () => {
      const { notify } = await import('../../bot/commands/notify');
      const interaction = makeInteraction({
        customId: 'notify_dm_toggle_select',
        values: ['enabled'],
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      });

      await invoke(notify.handleSelectMenu, interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      expect(String(interaction.reply.mock.calls[0][0].content)).toContain('Manage Server');
      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('allows a non-admin personal-preference select', async () => {
      const { notify } = await import('../../bot/commands/notify');
      const interaction = makeInteraction({
        customId: 'notify_my_toggle_select',
        values: ['lfgPingOptIn'],
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      });

      try {
        await invoke(notify.handleSelectMenu, interaction);
      } catch {
        /* preference service unmocked — irrelevant to the gate */
      }

      const denialReplies = interaction.reply.mock.calls.filter(call =>
        String((call[0] as { content?: string }).content).includes('Manage Server')
      );
      expect(denialReplies.length).toBe(0);
    });

    it('denies a non-admin guild LFG-config modal submission', async () => {
      const { notify } = await import('../../bot/commands/notify');
      const interaction = makeInteraction({
        customId: 'notify_lfg_config_modal',
        fields: { getTextInputValue: jest.fn(() => '8') },
        memberPermissions: { has: jest.fn().mockReturnValue(false) },
      });

      await invoke(notify.handleModal, interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      expect(String(interaction.reply.mock.calls[0][0].content)).toContain('Manage Server');
      expect(interaction.deferReply).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
