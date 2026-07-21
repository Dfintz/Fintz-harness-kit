jest.mock('../../../services/content/MissionService', () => {
  const missionServiceMock = {
    getAllMissions: jest.fn(),
    getActiveMissions: jest.fn(),
    getMissionById: jest.fn(),
    transitionStatus: jest.fn(),
    createMission: jest.fn(),
  };

  return {
    MissionService: jest.fn(() => missionServiceMock),
    __mockMissionService: missionServiceMock,
  };
});
jest.mock('../../../services/discord/GuildOrganizationService', () => {
  const instance = { resolveOrganization: jest.fn().mockResolvedValue('org-123') };
  return {
    GuildOrganizationService: {
      getInstance: jest.fn(() => instance),
    },
  };
});
jest.mock('../../utils/realtimeEmit', () => ({ emitRealtimeToOrg: jest.fn() }));
jest.mock('../../utils/dmAwareReply', () => ({ dmAwareEditReply: jest.fn() }));
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import {
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../../models/Mission';
import { __mockMissionService as missionSvcMock } from '../../../services/content/MissionService';
import { mission } from '../../commands/mission';
import { dmAwareEditReply } from '../../utils/dmAwareReply';
import { emitRealtimeToOrg } from '../../utils/realtimeEmit';
function mi(o: Record<string, unknown> = {}): ChatInputCommandInteraction {
  return {
    user: { id: 'u1', username: 't' },
    guildId: 'g1',
    deferred: false,
    replied: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn(),
    editReply: jest.fn(),
    options: {},
    ...o,
  } as unknown as ChatInputCommandInteraction;
}
describe('Mission Command', () => {
  beforeEach(() => jest.clearAllMocks());
  it('has correct metadata', () => {
    expect(mission.data.name).toBe('mission');
    expect(mission.category).toBe('events');
    expect(mission.guildOnly).toBe(true);
  });
  it('defines all handlers', () => {
    expect(typeof mission.execute).toBe('function');
    expect(typeof mission.handleButton).toBe('function');
    expect(typeof mission.handleSelectMenu).toBe('function');
    expect(typeof mission.handleModal).toBe('function');
  });
  it('shows panel on execute', async () => {
    const i = mi();
    await mission.execute(i);
    expect(i.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), flags: MessageFlags.Ephemeral })
    );
  });

  it('status-select flow keeps transition + realtime + editReply contracts', async () => {
    missionSvcMock.transitionStatus = jest.fn().mockResolvedValue({
      id: 'm-1',
      title: 'Run Alpha',
      status: MissionStatus.COMPLETED,
    });

    const interaction = {
      customId: 'mission_status_select_m-1',
      values: [MissionStatus.COMPLETED],
      guildId: 'g1',
      reply: jest.fn(),
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      user: { id: 'u1' },
    } as never;

    await mission.handleSelectMenu?.(interaction);

    expect(missionSvcMock.transitionStatus).toHaveBeenCalledWith(
      'm-1',
      'org-123',
      MissionStatus.COMPLETED
    );
    expect(emitRealtimeToOrg).toHaveBeenCalledWith('org-123', 'mission:status_changed', {
      missionId: 'm-1',
      title: 'Run Alpha',
      status: MissionStatus.COMPLETED,
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });

  it('create-modal flow keeps create + realtime + dmAwareEditReply contracts', async () => {
    missionSvcMock.createMission = jest.fn().mockResolvedValue({
      id: 'm-9',
      title: 'Cargo Lift',
      missionType: MissionType.CUSTOM,
      difficulty: MissionDifficulty.MEDIUM,
      priority: MissionPriority.NORMAL,
      location: 'Area18',
      reward: '50000 aUEC',
    });

    const interaction = {
      customId: 'mission_create_modal',
      guildId: 'g1',
      user: { id: 'u55' },
      reply: jest.fn(),
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      fields: {
        getTextInputValue: (id: string) => {
          const values: Record<string, string> = {
            title: 'Cargo Lift',
            description: 'Move freight',
            location: 'Area18',
            reward: '50000 aUEC',
          };
          return values[id] ?? '';
        },
      },
    } as never;

    await mission.handleModal?.(interaction);

    expect(missionSvcMock.createMission).toHaveBeenCalledWith(
      'org-123',
      expect.objectContaining({
        title: 'Cargo Lift',
        missionType: MissionType.CUSTOM,
        createdBy: 'u55',
      })
    );
    expect(emitRealtimeToOrg).toHaveBeenCalledWith('org-123', 'mission:created', {
      missionId: 'm-9',
      title: 'Cargo Lift',
      missionType: MissionType.CUSTOM,
      createdBy: 'u55',
    });
    expect(dmAwareEditReply).toHaveBeenCalledWith(
      interaction,
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
