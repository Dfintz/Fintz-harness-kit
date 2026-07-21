import { ActivityType } from '../../../models/Activity';
import { buildEventEmbed, type EventEmbedData } from '../eventEmbed';

function buildBaseEvent(overrides: Partial<EventEmbedData> = {}): EventEmbedData {
  return {
    id: 'activity-123',
    title: 'Operation Hammerfall',
    type: ActivityType.EVENT,
    status: 'open',
    description: 'A coordinated strike.',
    location: 'Stanton',
    creatorName: 'Captain Rayna',
    creatorId: 'user-1',
    postedAt: new Date('2026-06-12T10:00:00.000Z'),
    updatedAt: new Date('2026-06-12T12:34:56.000Z'),
    participants: [],
    ...overrides,
  };
}

describe('buildEventEmbed', () => {
  it('uses updatedAt as the footer timestamp and labels it as Last updated', () => {
    const updatedAt = new Date('2026-06-12T12:34:56.000Z');
    const embed = buildEventEmbed(buildBaseEvent({ updatedAt }));

    expect(embed.data.footer?.text).toContain('Last updated');
    expect(embed.data.timestamp).toBe(updatedAt.toISOString());
  });

  it('falls back to postedAt when updatedAt is absent', () => {
    const postedAt = new Date('2026-06-12T10:00:00.000Z');
    const embed = buildEventEmbed(buildBaseEvent({ updatedAt: undefined, postedAt }));

    expect(embed.data.timestamp).toBe(postedAt.toISOString());
  });

  it("caps oversized dynamic field values at Discord's 1024-character limit", () => {
    const manyRoles = Array.from({ length: 80 }, (_, index) => ({
      role: `role_${index}`,
      count: 1,
    }));

    const embed = buildEventEmbed(
      buildBaseEvent({
        roleRequirements: manyRoles,
      })
    );

    const roleField = embed.data.fields?.find(field => field.name === '📋 Role Requirements');
    expect(roleField).toBeDefined();
    expect(roleField?.value.length).toBeLessThanOrEqual(1024);
    expect(roleField?.value.endsWith('…')).toBe(true);
  });

  it('groups fleet-added ships under their fleet name in the ship section', () => {
    const embed = buildEventEmbed(
      buildBaseEvent({
        ships: [
          {
            id: 'ship-1',
            shipType: 'Carrack',
            shipName: 'Pathfinder One',
            ownerId: 'user-1',
            ownerName: 'Captain Rayna',
            fleetId: 'fleet-1',
            fleetName: 'Red Wing',
            role: 'support',
            crewCapacity: 6,
            crewAssigned: 3,
            crewMembers: [],
          },
          {
            id: 'ship-2',
            shipType: 'Gladius',
            shipName: 'Lancer Two',
            ownerId: 'user-2',
            ownerName: 'Pilot Two',
            fleetId: 'fleet-1',
            fleetName: 'Red Wing',
            role: 'combat',
            crewCapacity: 1,
            crewAssigned: 1,
            crewMembers: [],
          },
        ],
      })
    );

    const shipField = embed.data.fields?.find(field => field.name?.startsWith('🛸 Ships'));
    expect(shipField?.value).toContain('**Red Wing**');
    expect(shipField?.value).toContain('**Pathfinder One**');
    expect(shipField?.value).toContain('**Lancer Two**');
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
