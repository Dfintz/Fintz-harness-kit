import {
  __clearPlatformRbacCacheForTesting,
  __setUserServiceFactoryForTesting,
  isPlatformAdmin,
  requirePlatformAdmin,
} from '../../bot/utils/platformRbac';
import { MessageFlags } from 'discord.js';

type FakeUser = { id: string; role: string } | null;

function makeUserService(impl: (discordId: string) => Promise<FakeUser>) {
  return {
    getUserByDiscordId: jest.fn(impl),
  } as unknown as import('../../services/user/UserService').UserService & {
    getUserByDiscordId: jest.Mock;
  };
}

function makeInteraction(userId = 'user-1') {
  return {
    user: { id: userId },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
  } as unknown as import('discord.js').ChatInputCommandInteraction & {
    reply: jest.Mock;
    followUp: jest.Mock;
  };
}

describe('platformRbac', () => {
  afterEach(() => {
    __clearPlatformRbacCacheForTesting();
    jest.restoreAllMocks();
  });

  describe('isPlatformAdmin', () => {
    it('returns true for admin role', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'admin' }));
      __setUserServiceFactoryForTesting(() => svc);

      await expect(isPlatformAdmin('discord-1')).resolves.toBe(true);
    });

    it('returns true for superadmin role', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'superadmin' }));
      __setUserServiceFactoryForTesting(() => svc);

      await expect(isPlatformAdmin('discord-1')).resolves.toBe(true);
    });

    it('returns false for non-admin role', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'user' }));
      __setUserServiceFactoryForTesting(() => svc);

      await expect(isPlatformAdmin('discord-1')).resolves.toBe(false);
    });

    it('returns false when user is not found', async () => {
      const svc = makeUserService(async () => null);
      __setUserServiceFactoryForTesting(() => svc);

      await expect(isPlatformAdmin('missing')).resolves.toBe(false);
    });

    it('fails closed (false) when lookup throws', async () => {
      const svc = makeUserService(async () => {
        throw new Error('db down');
      });
      __setUserServiceFactoryForTesting(() => svc);

      await expect(isPlatformAdmin('discord-1')).resolves.toBe(false);
    });

    it('caches results within TTL (single DB call for repeated lookups)', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'admin' }));
      __setUserServiceFactoryForTesting(() => svc);

      await isPlatformAdmin('discord-1');
      await isPlatformAdmin('discord-1');
      await isPlatformAdmin('discord-1');

      expect(svc.getUserByDiscordId).toHaveBeenCalledTimes(1);
    });
  });

  describe('requirePlatformAdmin', () => {
    it('returns true and does not reply when user is platform admin', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'admin' }));
      __setUserServiceFactoryForTesting(() => svc);
      const interaction = makeInteraction();

      await expect(requirePlatformAdmin(interaction)).resolves.toBe(true);
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });

    it('returns false and replies ephemerally when user is not admin', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'user' }));
      __setUserServiceFactoryForTesting(() => svc);
      const interaction = makeInteraction();

      await expect(requirePlatformAdmin(interaction)).resolves.toBe(false);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.Ephemeral })
      );
    });

    it('uses followUp when interaction has already been replied to', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'user' }));
      __setUserServiceFactoryForTesting(() => svc);
      const interaction = makeInteraction();
      (interaction as unknown as { replied: boolean }).replied = true;

      await expect(requirePlatformAdmin(interaction)).resolves.toBe(false);
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ flags: MessageFlags.Ephemeral })
      );
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('uses followUp when interaction has been deferred', async () => {
      const svc = makeUserService(async () => ({ id: 'u1', role: 'user' }));
      __setUserServiceFactoryForTesting(() => svc);
      const interaction = makeInteraction();
      (interaction as unknown as { deferred: boolean }).deferred = true;

      await expect(requirePlatformAdmin(interaction)).resolves.toBe(false);
      expect(interaction.followUp).toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('fails closed (denies access) when lookup throws', async () => {
      const svc = makeUserService(async () => {
        throw new Error('db down');
      });
      __setUserServiceFactoryForTesting(() => svc);
      const interaction = makeInteraction();

      await expect(requirePlatformAdmin(interaction)).resolves.toBe(false);
      expect(interaction.reply).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
