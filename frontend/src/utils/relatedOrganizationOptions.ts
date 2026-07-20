import type { Alliance } from '@/services/allianceService';
import type { FederationMember, ManagedFederation } from '@/services/federationManagementService';
import type { Relationship } from '@/services/relationshipService';

export type RelatedOrganizationSource = 'relationship' | 'treaty' | 'federation';

export interface RelatedOrganizationOption {
  id: string;
  name: string;
  sources: RelatedOrganizationSource[];
}

export interface CrossOrgOption {
  id: string;
  name: string;
  group: 'Diplomacy Treaties' | 'Federations' | 'Allied Organizations';
}

interface BuildRelatedOrganizationsInput {
  organizationId: string;
  relationships?: Relationship[];
  alliances?: Alliance[];
  federations?: ManagedFederation[];
  includeOnlyPositiveRelationships?: boolean;
}

const ACTIVE_STATUSES = new Set(['active', 'approved']);
const POSITIVE_RELATIONSHIP_TYPES = new Set([
  'allied',
  'partnership',
  'cooperative',
  'affiliated',
  'trading_partner',
]);

const CROSS_ORG_GROUP_ORDER: Record<CrossOrgOption['group'], number> = {
  'Diplomacy Treaties': 0,
  Federations: 1,
  'Allied Organizations': 2,
};

type MutableRelatedOrganization = {
  id: string;
  name: string;
  sources: Set<RelatedOrganizationSource>;
};

const normalize = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

const isActiveStatus = (value: string | null | undefined): boolean =>
  ACTIVE_STATUSES.has(normalize(value));

const isPositiveRelationshipType = (value: string | null | undefined): boolean =>
  POSITIVE_RELATIONSHIP_TYPES.has(normalize(value));

function buildTreatyFallbackName(id: string): string {
  if (id.length <= 8) return `Org ${id}`;
  return `Org ${id.slice(0, 8)}...`;
}

function addOrganization(
  map: Map<string, MutableRelatedOrganization>,
  id: string,
  name: string | null | undefined,
  source: RelatedOrganizationSource
): void {
  const normalizedId = id.trim();
  if (!normalizedId) return;

  const candidateName = name?.trim() || normalizedId;
  const existing = map.get(normalizedId);
  if (existing) {
    if (existing.name === existing.id && candidateName !== normalizedId) {
      existing.name = candidateName;
    }
    existing.sources.add(source);
    return;
  }

  map.set(normalizedId, {
    id: normalizedId,
    name: candidateName,
    sources: new Set([source]),
  });
}

function addRelationshipOrganizations(
  map: Map<string, MutableRelatedOrganization>,
  organizationId: string,
  relationships: Relationship[],
  includeOnlyPositiveRelationships: boolean
): void {
  for (const relationship of relationships) {
    if (!relationship || !isActiveStatus(relationship.status)) continue;
    if (includeOnlyPositiveRelationships && !isPositiveRelationshipType(relationship.type)) {
      continue;
    }

    const targetId = relationship.targetOrganizationId ?? relationship.targetOrganization?.id;
    if (!targetId || targetId === organizationId) continue;

    addOrganization(
      map,
      targetId,
      relationship.targetOrganization?.name ?? targetId,
      'relationship'
    );
  }
}

function addTreatyOrganizations(
  map: Map<string, MutableRelatedOrganization>,
  organizationId: string,
  alliances: Alliance[]
): void {
  for (const alliance of alliances) {
    if (!alliance || !isActiveStatus(alliance.status)) continue;

    const otherOrgId =
      alliance.orgId1 === organizationId
        ? alliance.orgId2
        : alliance.orgId2 === organizationId
          ? alliance.orgId1
          : '';

    if (!otherOrgId || otherOrgId === organizationId) continue;

    addOrganization(map, otherOrgId, otherOrgId, 'treaty');
  }
}

function addFederationOrganizations(
  map: Map<string, MutableRelatedOrganization>,
  organizationId: string,
  federations: ManagedFederation[]
): void {
  for (const federation of federations) {
    if (!federation || !isActiveStatus(federation.status)) continue;

    for (const member of federation.members ?? []) {
      const federationMember = member as FederationMember;
      if (!isActiveStatus(federationMember.status)) continue;
      if (!federationMember.organizationId || federationMember.organizationId === organizationId) {
        continue;
      }

      addOrganization(
        map,
        federationMember.organizationId,
        federationMember.organizationName,
        'federation'
      );
    }
  }
}

export function buildRelatedOrganizationOptions({
  organizationId,
  relationships = [],
  alliances = [],
  federations = [],
  includeOnlyPositiveRelationships = false,
}: BuildRelatedOrganizationsInput): RelatedOrganizationOption[] {
  if (!organizationId) return [];

  const map = new Map<string, MutableRelatedOrganization>();

  addRelationshipOrganizations(
    map,
    organizationId,
    relationships,
    includeOnlyPositiveRelationships
  );
  addTreatyOrganizations(map, organizationId, alliances);
  addFederationOrganizations(map, organizationId, federations);

  return Array.from(map.values())
    .map(entry => ({
      id: entry.id,
      name: entry.name,
      sources: Array.from(entry.sources),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCrossOrgLfgOptions(
  input: Omit<BuildRelatedOrganizationsInput, 'includeOnlyPositiveRelationships'>
): CrossOrgOption[] {
  const relatedOrganizations = buildRelatedOrganizationOptions({
    ...input,
    includeOnlyPositiveRelationships: true,
  });

  const organizationOptions: CrossOrgOption[] = relatedOrganizations.map(org => {
    const hasTreatySource = org.sources.includes('treaty');
    const group: CrossOrgOption['group'] = hasTreatySource
      ? 'Diplomacy Treaties'
      : 'Allied Organizations';

    const name =
      group === 'Diplomacy Treaties' && org.name === org.id
        ? buildTreatyFallbackName(org.id)
        : org.name;

    return {
      id: org.id,
      name,
      group,
    };
  });

  const federationOptions: CrossOrgOption[] = (input.federations ?? [])
    .filter(federation => isActiveStatus(federation.status))
    .map(federation => ({
      id: `federation:${federation.id}`,
      name: federation.name,
      group: 'Federations' as const,
    }));

  return [...organizationOptions, ...federationOptions].sort((a, b) => {
    const aGroupOrder = CROSS_ORG_GROUP_ORDER[a.group];
    const bGroupOrder = CROSS_ORG_GROUP_ORDER[b.group];
    if (aGroupOrder !== bGroupOrder) return aGroupOrder - bGroupOrder;
    return a.name.localeCompare(b.name);
  });
}
