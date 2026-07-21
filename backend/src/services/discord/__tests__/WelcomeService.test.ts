import type { GuildMember, PartialGuildMember } from 'discord.js';

import { checkBotGuildPermissions } from '../../../bot/utils/discord';
import type { DiscordGuildSettings } from '../../../models/DiscordGuildSettings';
import { handleGuildMemberAdd, handleGuildMemberUpdate } from '../WelcomeService';

const mockGetSettingsByGuildId = jest.fn();

jest.mock('../DiscordSettingsService', () => ({
  DiscordSettingsService: jest.fn().mockImplementation(() => ({
    getSettingsByGuildId: mockGetSettingsByGuildId,
  })),
}));

jest.mock('../../../bot/utils/discord', () => ({
  checkBotGuildPermissions: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function buildSettings(autoRoleIds: string[]): DiscordGuildSettings {
  return {
    welcomeSettings: {
      welcomeEnabled: false,
      goodbyeEnabled: false,
      welcomeDmEnabled: false,
      autoRoleIds,
    },
  } as unknown as DiscordGuildSettings;
}

function createMockMember(options?: {
  pending?: boolean;
  isBot?: boolean;
  existingRoleIds?: string[];
}): {
  member: GuildMember;
  addRole: jest.Mock<Promise<void>, [string, string]>;
} {
  const assignedRoleIds = new Set(options?.existingRoleIds ?? []);
  const addRole = jest.fn<Promise<void>, [string, string]>(async roleId => {
    assignedRoleIds.add(roleId);
  });

  const member = {
    id: 'user-1',
    pending: options?.pending,
    displayName: 'Pilot',
    guild: {
      id: 'guild-1',
      name: 'Guild One',
      memberCount: 15,
      channels: { cache: new Map() },
    },
    user: {
      bot: options?.isBot ?? false,
      tag: 'pilot#0001',
      username: 'pilot',
      displayAvatarURL: jest.fn().mockReturnValue('https://example.invalid/avatar.png'),
      send: jest.fn(),
    },
    roles: {
      cache: {
        has: (roleId: string) => assignedRoleIds.has(roleId),
      },
      add: addRole,
    },
  } as unknown as GuildMember;

  return { member, addRole };
}

describe('WelcomeService onboarding-gated auto roles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkBotGuildPermissions as jest.Mock).mockReturnValue(true);
    mockGetSettingsByGuildId.mockResolvedValue([buildSettings(['role-a'])]);
  });

  it('does not assign auto-roles on guildMemberAdd when member is pending onboarding', async () => {
    const { member, addRole } = createMockMember({ pending: true });

    await handleGuildMemberAdd(member);

    expect(addRole).not.toHaveBeenCalled();
  });

  it('assigns auto-roles on guildMemberUpdate when pending transitions to accepted', async () => {
    const oldMember = { pending: true } as PartialGuildMember;
    const { member: newMember, addRole } = createMockMember({ pending: false });

    await handleGuildMemberUpdate(oldMember, newMember);

    expect(addRole).toHaveBeenCalledTimes(1);
    expect(addRole).toHaveBeenCalledWith('role-a', 'Welcome auto-role after onboarding');
  });

  it('does not assign auto-roles on guildMemberUpdate when member is still pending', async () => {
    const oldMember = { pending: true } as PartialGuildMember;
    const { member: newMember, addRole } = createMockMember({ pending: true });

    await handleGuildMemberUpdate(oldMember, newMember);

    expect(addRole).not.toHaveBeenCalled();
  });
});
