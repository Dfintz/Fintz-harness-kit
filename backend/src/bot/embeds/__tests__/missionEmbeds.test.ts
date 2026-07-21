import {
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../../models/Mission';
import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildMissionCreatedEmbed,
  buildMissionDetailEmbed,
  buildMissionListEmbed,
  buildMissionStatusUpdatedEmbed,
} from '../missionEmbeds';

describe('missionEmbeds', () => {
  it('buildMissionDetailEmbed preserves mission detail contract', () => {
    const embed = buildMissionDetailEmbed({
      id: 'm-123',
      title: 'Operation Hammer',
      description: '',
      status: MissionStatus.IN_PROGRESS,
      missionType: MissionType.COMBAT,
      difficulty: MissionDifficulty.HARD,
      priority: MissionPriority.CRITICAL,
      location: 'Yela',
      reward: '100000 aUEC',
      participants: [
        { userId: 'u1', role: 'leader', joinedAt: new Date() },
        { userId: 'u2', role: 'member', joinedAt: new Date() },
      ],
      objectives: [
        { title: 'Secure zone', description: '', completed: true },
        { title: 'Extract VIP', description: '', completed: false },
      ],
      startDate: new Date('2026-06-24T12:00:00.000Z'),
      endDate: new Date('2026-06-24T13:00:00.000Z'),
      createdAt: new Date('2026-06-24T11:00:00.000Z'),
      updatedAt: new Date('2026-06-24T11:30:00.000Z'),
    } as never);

    expect(embed.data.title).toBe('⚔️ Operation Hammer');
    expect(embed.data.color).toBe(0xf1c40f);
    expect(embed.data.url).toContain('/missions/m-123');
    expect(embed.data.description).toBe('*No description provided*');
    expect(embed.data.footer?.text).toBe('Mission ID: m-123');

    const fieldNames = (embed.data.fields ?? []).map(f => f.name);
    expect(fieldNames).toContain('Status');
    expect(fieldNames).toContain('Type');
    expect(fieldNames).toContain('Difficulty');
    expect(fieldNames).toContain('Priority');
    expect(fieldNames).toContain('📍 Location');
    expect(fieldNames).toContain('🏆 Reward');
    expect(fieldNames).toContain('Participants (2)');
    expect(fieldNames).toContain('Objectives (1/2)');
  });

  it('buildMissionListEmbed preserves list and empty-state contracts', () => {
    const empty = buildMissionListEmbed([], '🎯 Organization Missions');
    expect(empty.data.description).toBe('*No missions found.*');

    const populated = buildMissionListEmbed(
      [
        {
          id: 'm-1',
          title: 'Run Alpha',
          status: MissionStatus.PLANNED,
          missionType: MissionType.LOGISTICS,
          priority: MissionPriority.NORMAL,
          difficulty: MissionDifficulty.EASY,
        },
      ] as never,
      '🚀 Active Missions'
    );

    expect(populated.data.color).toBe(EmbedColors.SC_BLUE);
    expect(populated.data.title).toBe('🚀 Active Missions');
    expect(populated.data.description).toContain('📦 Run Alpha');
    expect(populated.data.footer?.text).toBe('1 mission(s)');
  });

  it('buildMissionStatusUpdatedEmbed preserves status-change message contract', () => {
    const embed = buildMissionStatusUpdatedEmbed({
      missionId: 'm-22',
      missionTitle: 'Night Shift',
      status: MissionStatus.COMPLETED,
    });

    expect(embed.data.title).toBe('✅ Mission Status Updated');
    expect(embed.data.description).toBe('**Night Shift** is now **Completed**.');
    expect(embed.data.footer?.text).toBe('Mission ID: m-22');
  });

  it('buildMissionCreatedEmbed preserves created-message contract including optional fields', () => {
    const embed = buildMissionCreatedEmbed({
      missionId: 'm-44',
      missionTitle: 'Cargo Lift',
      missionType: MissionType.TRADING,
      difficulty: MissionDifficulty.MEDIUM,
      priority: MissionPriority.HIGH,
      location: 'ArcCorp',
      reward: '50000 aUEC',
    });

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('✅ Mission Created');
    expect(embed.data.description).toContain('Cargo Lift');
    expect(embed.data.footer?.text).toBe('Mission ID: m-44');

    const fieldNames = (embed.data.fields ?? []).map(f => f.name);
    expect(fieldNames).toEqual(['Type', 'Difficulty', 'Priority', '📍 Location', '🏆 Reward']);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
