import { EmbedColors } from '../../utils/embedBuilder';
import { buildOrgPublicFleetSnapshotEmbed, buildOrgRootHubEmbed } from '../orgEmbeds';

describe('buildOrgRootHubEmbed', () => {
  it('builds the org command root hub embed contract', () => {
    const embed = buildOrgRootHubEmbed();

    expect(embed.data.title).toBe('🏢 Org Command Hub');
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.description).toContain('Organization operations root panel.');
    expect(embed.data.description).toContain('🚀 **Fleet** — Summary, list, and public snapshot');
    expect(embed.data.footer?.text).toBe('Org panel root');
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('buildOrgPublicFleetSnapshotEmbed', () => {
  it('builds the org public fleet snapshot embed contract', () => {
    const embed = buildOrgPublicFleetSnapshotEmbed({
      organizationLabel: 'UEE Navy',
      totalFleets: 4,
      totalShips: 27,
      activeFleetCount: 3,
      publicFleetCount: 2,
      statusBreakdown: 'active: 3 • standby: 1',
      roleBreakdown: 'combat: 2 • support: 1 • logistics: 1',
      topFleets: '1. Vanguard Wing • 10 ships • active/combat',
      fleetUrl: 'https://fringecore.space/fleet',
    });

    expect(embed.data.title).toBe('🚀 Fleet Snapshot — UEE Navy');
    expect(embed.data.url).toBe('https://fringecore.space/fleet');
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.description).toBe(
      'Snapshot shared from the SC Fleet Manager Discord org panel.'
    );

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(5);
    expect(fields[0]).toMatchObject({ name: 'Totals', inline: true });
    expect(fields[1]).toMatchObject({ name: 'Visibility', inline: true });
    expect(fields[2]).toMatchObject({ name: 'Status Breakdown', inline: true });
    expect(fields[3]).toMatchObject({ name: 'Role Breakdown', inline: true });
    expect(fields[4]).toMatchObject({ name: 'Top 3 Fleets', inline: false });

    expect(fields[0].value).toContain('Fleets: **4**');
    expect(fields[0].value).toContain('Ships assigned: **27**');
    expect(fields[1].value).toContain('Public-enabled fleets: **2**');
    expect(fields[4].value).toContain('Vanguard Wing');

    expect(embed.data.footer?.text).toBe('Open full fleet details in the web app');
    expect(embed.data.timestamp).toBeDefined();
  });

  it('uses the top-fleets fallback when input is empty', () => {
    const embed = buildOrgPublicFleetSnapshotEmbed({
      organizationLabel: 'UEE Navy',
      totalFleets: 0,
      totalShips: 0,
      activeFleetCount: 0,
      publicFleetCount: 0,
      statusBreakdown: 'None',
      roleBreakdown: 'None',
      topFleets: '',
      fleetUrl: 'https://fringecore.space/fleet',
    });

    const fields = embed.data.fields ?? [];
    expect(fields[4]?.value).toBe('No fleets yet.');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
