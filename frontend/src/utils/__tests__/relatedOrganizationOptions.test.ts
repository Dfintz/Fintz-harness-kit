import type { Alliance } from '@/services/allianceService';
import type { ManagedFederation } from '@/services/federationManagementService';
import type { Relationship } from '@/services/relationshipService';
import {
  buildCrossOrgLfgOptions,
  buildRelatedOrganizationOptions,
} from '@/utils/relatedOrganizationOptions';

describe('relatedOrganizationOptions', () => {
  const organizationId = 'org-source';

  const relationships: Relationship[] = [
    {
      id: 'rel-1',
      organizationId,
      targetOrganizationId: 'org-relationship',
      type: 'allied',
      status: 'active',
      targetOrganization: { id: 'org-relationship', name: 'Relationship Org' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Relationship,
    {
      id: 'rel-2',
      organizationId,
      targetOrganizationId: 'org-hostile',
      type: 'hostile',
      status: 'active',
      targetOrganization: { id: 'org-hostile', name: 'Hostile Org' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Relationship,
  ];

  const alliances: Alliance[] = [
    {
      id: 'alliance-1',
      orgId1: organizationId,
      orgId2: 'org-treaty',
      allianceType: 'trade',
      status: 'ACTIVE' as unknown as Alliance['status'],
      proposedBy: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Alliance,
  ];

  const federations: ManagedFederation[] = [
    {
      id: 'fed-1',
      name: 'Federation One',
      description: 'Test federation',
      status: 'ACTIVE' as unknown as ManagedFederation['status'],
      isPublic: true,
      tags: [],
      members: [
        {
          id: 'member-1',
          organizationId,
          organizationName: 'Source Org',
          role: 'member',
          status: 'ACTIVE' as unknown as ManagedFederation['members'][number]['status'],
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'member-2',
          organizationId: 'org-federation',
          organizationName: 'Federation Org',
          role: 'member',
          status: 'ACTIVE' as unknown as ManagedFederation['members'][number]['status'],
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as ManagedFederation,
  ];

  it('builds related organizations from relationships, treaties, and federations', () => {
    const options = buildRelatedOrganizationOptions({
      organizationId,
      relationships,
      alliances,
      federations,
    });

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'org-relationship', name: 'Relationship Org' }),
        expect.objectContaining({ id: 'org-treaty' }),
        expect.objectContaining({ id: 'org-federation', name: 'Federation Org' }),
      ])
    );
  });

  it('builds LFG options with federation entries and filters non-positive relationships', () => {
    const options = buildCrossOrgLfgOptions({
      organizationId,
      relationships,
      alliances,
      federations,
    });

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'org-relationship', group: 'Allied Organizations' }),
        expect.objectContaining({ id: 'org-treaty', group: 'Diplomacy Treaties' }),
        expect.objectContaining({ id: 'federation:fed-1', group: 'Federations' }),
      ])
    );

    expect(options.some(option => option.id === 'org-hostile')).toBe(false);
  });
});
