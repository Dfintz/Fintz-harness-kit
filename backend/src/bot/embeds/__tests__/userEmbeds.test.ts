import { EmbedColors } from '../../utils/embedBuilder';
import { buildUserPublicHangarSnapshotEmbed, buildUserRootHubEmbed } from '../userEmbeds';

describe('buildUserRootHubEmbed', () => {
  it('builds the /user root hub embed contract', () => {
    const embed = buildUserRootHubEmbed();

    expect(embed.data.title).toBe('🧑 User Command Hub');
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.footer?.text).toBe('User panel root');
    expect(embed.data.timestamp).toBeDefined();
    expect(embed.data.description).toContain('🚀 **Hangar** — Open user hangar subpanel');
    expect(embed.data.description).toContain('❓ **Help** — Access help, FAQ, and setup guides');
  });
});

describe('buildUserPublicHangarSnapshotEmbed', () => {
  it('builds the public hangar snapshot embed contract', () => {
    const embed = buildUserPublicHangarSnapshotEmbed({
      displayName: 'Pilot',
      totalShips: 12,
      needsInsurance: 3,
      totalValue: 10500,
      publicCount: 4,
      orgCount: 5,
      allianceCount: 2,
      statusBreakdown: 'active: 8 • loaned: 2 • stored: 2',
      roleBreakdown: 'combat: 6 • support: 3 • industrial: 3',
      topShips: '1. Gladius • active\n2. Cutlass Black • stored\n3. Vulture • active',
      hangarUrl: 'https://fringecore.space/hangar',
    });

    expect(embed.data.title).toBe('🚀 Hangar Summary — Pilot');
    expect(embed.data.url).toBe('https://fringecore.space/hangar');
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.description).toBe('Snapshot shared from the SC Fleet Manager Discord panel.');

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(5);
    expect(fields[0]).toMatchObject({ name: 'Inventory', inline: true });
    expect(fields[1]).toMatchObject({ name: 'Sharing', inline: true });
    expect(fields[2]).toMatchObject({ name: 'Status Breakdown', inline: true });
    expect(fields[3]).toMatchObject({ name: 'Role Breakdown', inline: true });
    expect(fields[4]).toMatchObject({ name: 'Top 3 Ships', inline: false });

    expect(fields[0].value).toContain('Total ships: **12**');
    expect(fields[0].value).toContain('Insurance due (30d): **3**');
    expect(fields[1].value).toContain('Public: **4**');
    expect(fields[4].value).toContain('1. Gladius • active');

    expect(embed.data.footer?.text).toBe('Open full details in the web hangar');
    expect(embed.data.timestamp).toBeDefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
