// Mock services before importing to prevent EntityMetadataNotFoundError
jest.mock('../../services/federation/FederationDiscordService');
jest.mock('../../services/federation/FederationRoleSyncService');

import { federation } from '../../bot/commands/federation';

describe('Discord Bot — /federation command', () => {
  describe('Command Registration', () => {
    it('should have correct name and description', () => {
      expect(federation.data.name).toBe('federation');
      expect(federation.data.description).toBe('Manage federation Discord server settings');
    });

    it('should be an organization category command', () => {
      expect(federation.category).toBe('organization');
    });

    it('should be guild-only', () => {
      expect(federation.guildOnly).toBe(true);
    });

    it('should have execute function', () => {
      expect(typeof federation.execute).toBe('function');
    });

    it('should have handleSelectMenu function', () => {
      expect(typeof federation.handleSelectMenu).toBe('function');
    });
  });

  describe('Command Shape', () => {
    it('should use panel-based flow without slash subcommands', () => {
      const commandJson = federation.data.toJSON() as { options?: unknown[] };
      expect(commandJson.options ?? []).toHaveLength(0);
    });

    it('should have button and modal handlers for panel interactions', () => {
      expect(typeof federation.handleButton).toBe('function');
      expect(typeof federation.handleModal).toBe('function');
    });
  });

  describe('Execute — no guildId', () => {
    it('should reply with error if not in a guild', async () => {
      const mockReply = jest.fn();
      const interaction = {
        guildId: null,
        reply: mockReply,
      } as any;

      await federation.execute(interaction);

      expect(mockReply).toHaveBeenCalledWith({
        content: '❌ This command can only be used in a Discord server.',
        flags: 64,
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
