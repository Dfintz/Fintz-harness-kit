// Mock services before importing commands to prevent EntityMetadataNotFoundError
jest.mock('../../services/activity/ActivityService');
jest.mock('../../services/activity/ActivityEventService');
jest.mock('../../services/activity/EventMirrorService');
jest.mock('../../services/communication/voice/VoiceChannelService');
jest.mock('../../services/content/MissionService');
jest.mock('../../services/content/AIBriefingGenerationService');
jest.mock('../../services/discord/GuildOrganizationService');
jest.mock('../../services/social/SocialGroupService');

import { briefing } from '../../bot/commands/briefing';
import { commlink } from '../../bot/commands/commlink';
import { events } from '../../bot/commands/events';
import { help } from '../../bot/commands/help';
import { lfg } from '../../bot/commands/lfg';
import { mission } from '../../bot/commands/mission';
import { ping } from '../../bot/commands/ping';
import { VoiceChannelService } from '../../services/communication';
import { SocialGroupService } from '../../services/social';

const getCommandOptions = (command: {
  data: { toJSON: () => { options?: unknown[] } };
}): unknown[] => {
  const json = command.data.toJSON();
  return json.options ?? [];
};

describe('Discord Bot Commands', () => {
  afterAll(() => {
    // Stop cleanup intervals from services instantiated during command imports.
    const voiceService = VoiceChannelService.getInstance();
    if (voiceService) {
      voiceService.stopCleanupTask();
    }

    const socialGroupService = SocialGroupService.getInstance();
    if (socialGroupService) {
      socialGroupService.stopCleanup();
    }

    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Command Registration', () => {
    it('should have ping command metadata', () => {
      expect(ping.data.name).toBe('ping');
      expect(ping.data.description).toBe('Check bot latency and response time');
    });

    it('should have help command metadata', () => {
      expect(help.data.name).toBe('help');
      expect(help.data.description).toBe('Help, FAQ, and wiki — all in one place');
    });

    it('should have events command metadata', () => {
      expect(events.data.name).toBe('events');
      expect(events.data.description).toBe('Manage and view fleet events');
      expect(events.category).toBe('events');
    });

    it('should have commlink command metadata', () => {
      expect(commlink.data.name).toBe('commlink');
      expect(commlink.data.description).toBe('Manage cross-server comm links');
    });

    it('should have lfg command metadata', () => {
      expect(lfg.data.name).toBe('lfg');
      expect(lfg.data.description).toBe('Looking For Group - Quick group formation');
      expect(lfg.category).toBe('social');
      expect(lfg.cooldown).toBe(5);
      expect(lfg.guildOnly).toBe(true);
    });

    it('should have mission command metadata', () => {
      expect(mission.data.name).toBe('mission');
      expect(mission.data.description).toBe('Create, list, and manage organization missions');
      expect(mission.category).toBe('events');
      expect(mission.cooldown).toBe(5);
      expect(mission.guildOnly).toBe(true);
    });

    it('should have briefing command metadata', () => {
      expect(briefing.data.name).toBe('briefing');
      expect(briefing.data.description).toBe('Generate mission briefings');
      expect(briefing.category).toBe('organization');
      expect(briefing.cooldown).toBe(10);
      expect(briefing.guildOnly).toBe(true);
    });
  });

  describe('Execution Contracts', () => {
    it('should expose execute for all tested commands', () => {
      expect(typeof ping.execute).toBe('function');
      expect(typeof help.execute).toBe('function');
      expect(typeof events.execute).toBe('function');
      expect(typeof commlink.execute).toBe('function');
      expect(typeof lfg.execute).toBe('function');
      expect(typeof mission.execute).toBe('function');
      expect(typeof briefing.execute).toBe('function');
    });

    it('should expose panel interaction handlers for panel-based commands', () => {
      expect(typeof events.handleButton).toBe('function');
      expect(typeof events.handleSelectMenu).toBe('function');
      expect(typeof events.handleModal).toBe('function');

      expect(typeof lfg.handleButton).toBe('function');
      expect(typeof lfg.handleSelectMenu).toBe('function');
      expect(typeof lfg.handleModal).toBe('function');

      expect(typeof mission.handleButton).toBe('function');
      expect(typeof mission.handleSelectMenu).toBe('function');
      expect(typeof mission.handleModal).toBe('function');

      expect(typeof briefing.handleButton).toBe('function');
      expect(typeof briefing.handleSelectMenu).toBe('function');
      expect(typeof briefing.handleModal).toBe('function');
    });
  });

  describe('Panel Command Shape', () => {
    it('should not define slash subcommand options on panel-style commands', () => {
      expect(getCommandOptions(events)).toHaveLength(0);
      expect(getCommandOptions(lfg)).toHaveLength(0);
      expect(getCommandOptions(mission)).toHaveLength(0);
      expect(getCommandOptions(briefing)).toHaveLength(0);
      expect(getCommandOptions(help)).toHaveLength(0);
    });

    it('should keep examples for user guidance where provided', () => {
      expect(Array.isArray(lfg.examples)).toBe(true);
      expect(lfg.examples?.length).toBeGreaterThan(0);

      expect(Array.isArray(mission.examples)).toBe(true);
      expect(mission.examples?.length).toBeGreaterThan(0);

      expect(Array.isArray(briefing.examples)).toBe(true);
      expect(briefing.examples?.length).toBeGreaterThan(0);
    });
  });
});
