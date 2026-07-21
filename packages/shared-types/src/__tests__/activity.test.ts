/**
 * Unit tests for shared-types activity module.
 *
 * These tests verify that the exported union types contain exactly the expected
 * literal values and that the exported interfaces accept well-formed objects.
 * Compile-time correctness is enforced via @ts-expect-error annotations (any
 * annotation that does NOT suppress a real error will itself cause a TS error,
 * so these act as negative tests that are checked by `tsc --noEmit`).
 */

import type {
  Activity,
  ActivityParticipant,
  ActivityRequirements,
  ActivityRewards,
  ActivityStatus,
  ActivityType,
  ActivityV2,
  ActivityVisibility,
  CreateActivityRequest,
  ParticipantRole,
  ParticipationStatus,
  UpdateActivityRequest,
} from '../models/activity';

// ---------------------------------------------------------------------------
// Helper – compile-time identity function to prove an object satisfies a type.
// ---------------------------------------------------------------------------
function assertType<T>(_value: T): void {
  // intentionally empty; existence of this call proves the value type-checks
}

// ===========================================================================
// 1. ActivityType
// ===========================================================================
describe('ActivityType', () => {
  const ALL_ACTIVITY_TYPES: ActivityType[] = [
    'mission',
    'contract',
    'bounty',
    'event',
    'lfg',
    'operation',
    'job_listing',
  ];

  it('should include exactly 7 valid activity types', () => {
    expect(ALL_ACTIVITY_TYPES).toHaveLength(7);
  });

  it.each(ALL_ACTIVITY_TYPES)('should accept "%s" as a valid ActivityType', t => {
    const value: ActivityType = t;
    expect(value).toBe(t);
  });

  it('should NOT include "recruitment" (compile-time check)', () => {
    // @ts-expect-error - 'recruitment' is not a valid ActivityType
    const invalid: ActivityType = 'recruitment';
    // Runtime guard just to silence the unused-variable linter
    expect(invalid).toBe('recruitment');
  });

  it('should NOT include "patrol" (compile-time check)', () => {
    // @ts-expect-error - 'patrol' is not a valid ActivityType
    const invalid: ActivityType = 'patrol';
    expect(invalid).toBe('patrol');
  });

  it('should NOT include an empty string (compile-time check)', () => {
    // @ts-expect-error - empty string is not a valid ActivityType
    const invalid: ActivityType = '';
    expect(invalid).toBe('');
  });
});

// ===========================================================================
// 2. ActivityStatus
// ===========================================================================
describe('ActivityStatus', () => {
  const ALL_STATUSES: ActivityStatus[] = [
    'draft',
    'open',
    'planning',
    'recruiting',
    'ready',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'expired',
  ];

  it('should include exactly 10 valid status values', () => {
    expect(ALL_STATUSES).toHaveLength(10);
  });

  it.each(ALL_STATUSES)('should accept "%s" as a valid ActivityStatus', s => {
    const value: ActivityStatus = s;
    expect(value).toBe(s);
  });

  it('should NOT include "archived" (compile-time check)', () => {
    // @ts-expect-error - 'archived' is not a valid ActivityStatus
    const invalid: ActivityStatus = 'archived';
    expect(invalid).toBe('archived');
  });

  it('should NOT include "pending" (compile-time check)', () => {
    // @ts-expect-error - 'pending' is not a valid ActivityStatus
    const invalid: ActivityStatus = 'pending';
    expect(invalid).toBe('pending');
  });
});

// ===========================================================================
// 3. ActivityVisibility
// ===========================================================================
describe('ActivityVisibility', () => {
  const ALL_VISIBILITIES: ActivityVisibility[] = [
    'public',
    'organization',
    'cross_org',
    'alliance',
    'private',
    'listed',
  ];

  it('should include exactly 6 visibility options', () => {
    expect(ALL_VISIBILITIES).toHaveLength(6);
  });

  it.each(ALL_VISIBILITIES)('should accept "%s" as a valid ActivityVisibility', v => {
    const value: ActivityVisibility = v;
    expect(value).toBe(v);
  });

  it('should NOT include "unlisted" (compile-time check)', () => {
    // @ts-expect-error - 'unlisted' is not a valid ActivityVisibility
    const invalid: ActivityVisibility = 'unlisted';
    expect(invalid).toBe('unlisted');
  });

  it('should NOT include "hidden" (compile-time check)', () => {
    // @ts-expect-error - 'hidden' is not a valid ActivityVisibility
    const invalid: ActivityVisibility = 'hidden';
    expect(invalid).toBe('hidden');
  });
});

// ===========================================================================
// 4. ParticipantRole
// ===========================================================================
describe('ParticipantRole', () => {
  const ALL_ROLES: ParticipantRole[] = [
    'leader',
    'co_leader',
    'commander',
    'pilot',
    'gunner',
    'engineer',
    'medic',
    'scout',
    'tank',
    'dps',
    'support',
    'contractor',
    'client',
    'hunter',
    'member',
    'any',
  ];

  it('should include exactly 16 participant roles', () => {
    expect(ALL_ROLES).toHaveLength(16);
  });

  it.each(ALL_ROLES)('should accept "%s" as a valid ParticipantRole', r => {
    const value: ParticipantRole = r;
    expect(value).toBe(r);
  });

  it('should NOT include "admin" (compile-time check)', () => {
    // @ts-expect-error - 'admin' is not a valid ParticipantRole
    const invalid: ParticipantRole = 'admin';
    expect(invalid).toBe('admin');
  });

  it('should NOT include "healer" (compile-time check)', () => {
    // @ts-expect-error - 'healer' is not a valid ParticipantRole
    const invalid: ParticipantRole = 'healer';
    expect(invalid).toBe('healer');
  });
});

// ===========================================================================
// 5. ParticipationStatus
// ===========================================================================
describe('ParticipationStatus', () => {
  const ALL_PARTICIPATION_STATUSES: ParticipationStatus[] = [
    'invited',
    'accepted',
    'declined',
    'standby',
  ];

  it('should include exactly 4 participation statuses', () => {
    expect(ALL_PARTICIPATION_STATUSES).toHaveLength(4);
  });

  it.each(ALL_PARTICIPATION_STATUSES)('should accept "%s" as a valid ParticipationStatus', ps => {
    const value: ParticipationStatus = ps;
    expect(value).toBe(ps);
  });

  it('should NOT include "pending" (compile-time check)', () => {
    // @ts-expect-error - 'pending' is not a valid ParticipationStatus
    const invalid: ParticipationStatus = 'pending';
    expect(invalid).toBe('pending');
  });

  it('should NOT include "confirmed" (compile-time check)', () => {
    // @ts-expect-error - 'confirmed' is not a valid ParticipationStatus
    const invalid: ParticipationStatus = 'confirmed';
    expect(invalid).toBe('confirmed');
  });
});

// ===========================================================================
// 6. Interface structural tests
// ===========================================================================
describe('Activity interface', () => {
  const validActivity: Activity = {
    id: 'act-001',
    title: 'Mining Run',
    description: 'Quantanium mining in Aaron Halo',
    type: 'mission',
    status: 'open',
    organizationId: 'org-001',
    creatorId: 'user-001',
    isPublic: true,
    tags: ['mining', 'quantanium'],
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-01-15T12:00:00Z',
  };

  it('should accept a fully populated Activity object', () => {
    assertType<Activity>(validActivity);
    expect(validActivity.id).toBe('act-001');
    expect(validActivity.type).toBe('mission');
    expect(validActivity.status).toBe('open');
    expect(validActivity.tags).toEqual(['mining', 'quantanium']);
  });

  it('should accept Activity with optional fields populated', () => {
    const full: Activity = {
      ...validActivity,
      teamId: 'team-001',
      team: { id: 'team-001', name: 'Alpha Squad', type: 'mining' },
      scheduledStartDate: '2026-02-01T08:00:00Z',
      scheduledEndDate: '2026-02-01T12:00:00Z',
      actualStartDate: new Date('2026-02-01T08:15:00Z'),
      actualEndDate: new Date('2026-02-01T11:45:00Z'),
      location: 'Aaron Halo Belt',
      maxParticipants: 8,
    };
    assertType<Activity>(full);
    expect(full.teamId).toBe('team-001');
    expect(full.team?.name).toBe('Alpha Squad');
    expect(full.maxParticipants).toBe(8);
  });

  it('should accept Date objects for date fields', () => {
    const withDates: Activity = {
      ...validActivity,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheduledStartDate: new Date(),
    };
    assertType<Activity>(withDates);
    expect(withDates.createdAt).toBeInstanceOf(Date);
  });

  it('should NOT allow missing required fields (compile-time check)', () => {
    // @ts-expect-error - missing required 'title' field
    const noTitle: Activity = {
      id: 'act-002',
      type: 'bounty',
      status: 'draft',
      organizationId: 'org-001',
      creatorId: 'user-001',
      isPublic: false,
      tags: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(noTitle).toBeDefined();
  });

  it('should NOT allow an invalid type value (compile-time check)', () => {
    const badType: Activity = {
      ...validActivity,
      // @ts-expect-error - 'raid' is not a valid ActivityType
      type: 'raid',
    };
    expect(badType).toBeDefined();
  });
});

describe('ActivityV2 interface', () => {
  const baseActivity: Activity = {
    id: 'act-v2-001',
    title: 'Bounty Hunt',
    type: 'bounty',
    status: 'recruiting',
    organizationId: 'org-002',
    creatorId: 'user-002',
    isPublic: true,
    tags: ['bounty', 'pvp'],
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  };

  it('should accept a valid ActivityV2 with participantCount', () => {
    const v2: ActivityV2 = {
      ...baseActivity,
      participantCount: 5,
    };
    assertType<ActivityV2>(v2);
    expect(v2.participantCount).toBe(5);
  });

  it('should accept ActivityV2 with requirements and rewards', () => {
    const v2Full: ActivityV2 = {
      ...baseActivity,
      participantCount: 3,
      requirements: {
        minRank: 'sergeant',
        requiredShipTypes: ['fighter', 'bomber'],
        requiredRoles: ['pilot', 'gunner'],
      },
      rewards: {
        aUEC: 50000,
        reputation: 100,
        items: ['Rare Helmet'],
      },
    };
    assertType<ActivityV2>(v2Full);
    expect(v2Full.requirements?.minRank).toBe('sergeant');
    expect(v2Full.rewards?.aUEC).toBe(50000);
    expect(v2Full.rewards?.items).toContain('Rare Helmet');
  });

  it('should NOT allow ActivityV2 without participantCount (compile-time check)', () => {
    // @ts-expect-error - missing required 'participantCount' in ActivityV2
    const noCount: ActivityV2 = {
      ...baseActivity,
    };
    expect(noCount).toBeDefined();
  });
});

describe('ActivityRequirements interface', () => {
  it('should accept an empty object (all fields optional)', () => {
    const empty: ActivityRequirements = {};
    assertType<ActivityRequirements>(empty);
    expect(empty).toEqual({});
  });

  it('should accept a fully populated requirements object', () => {
    const full: ActivityRequirements = {
      minRank: 'captain',
      requiredShipTypes: ['Hammerhead', 'Javelin'],
      requiredRoles: ['commander', 'pilot'],
    };
    assertType<ActivityRequirements>(full);
    expect(full.requiredShipTypes).toHaveLength(2);
  });
});

describe('ActivityRewards interface', () => {
  it('should accept an empty object (all fields optional)', () => {
    const empty: ActivityRewards = {};
    assertType<ActivityRewards>(empty);
    expect(empty).toEqual({});
  });

  it('should accept a fully populated rewards object', () => {
    const full: ActivityRewards = {
      aUEC: 100000,
      reputation: 250,
      items: ['Gold Medal', 'Special Skin'],
    };
    assertType<ActivityRewards>(full);
    expect(full.aUEC).toBe(100000);
  });
});

describe('ActivityParticipant interface', () => {
  it('should accept a valid participant with required fields', () => {
    const participant: ActivityParticipant = {
      userId: 'user-010',
      username: 'PilotAce',
      role: 'pilot',
      status: 'accepted',
      joinedAt: '2026-02-20T14:30:00Z',
    };
    assertType<ActivityParticipant>(participant);
    expect(participant.userId).toBe('user-010');
    expect(participant.status).toBe('accepted');
  });

  it('should accept a participant with all optional fields', () => {
    const full: ActivityParticipant = {
      userId: 'user-020',
      username: 'MedicMain',
      displayName: 'Doc Holiday',
      avatar: 'https://cdn.example.com/avatars/user-020.png',
      role: 'medic',
      status: 'invited',
      shipType: 'Cutlass Red',
      joinedAt: new Date('2026-02-25T09:00:00Z'),
      confirmedAt: '2026-02-25T10:00:00Z',
    };
    assertType<ActivityParticipant>(full);
    expect(full.displayName).toBe('Doc Holiday');
    expect(full.shipType).toBe('Cutlass Red');
  });

  it('should NOT allow an invalid ParticipationStatus (compile-time check)', () => {
    const badStatus: ActivityParticipant = {
      userId: 'user-030',
      username: 'Griefer',
      role: 'member',
      // @ts-expect-error - 'kicked' is not a valid ParticipationStatus
      status: 'kicked',
      joinedAt: '2026-03-01T00:00:00Z',
    };
    expect(badStatus).toBeDefined();
  });
});

describe('CreateActivityRequest interface', () => {
  it('should accept a minimal create request', () => {
    const minimal: CreateActivityRequest = {
      title: 'Quick Mission',
      type: 'mission',
    };
    assertType<CreateActivityRequest>(minimal);
    expect(minimal.title).toBe('Quick Mission');
    expect(minimal.type).toBe('mission');
  });

  it('should accept a fully populated create request', () => {
    const full: CreateActivityRequest = {
      title: 'Large-Scale Operation',
      description: 'Multi-org combat sweep in Stanton',
      type: 'operation',
      scheduledStartDate: '2026-04-01T20:00:00Z',
      scheduledEndDate: '2026-04-01T23:00:00Z',
      location: 'Stanton System',
      maxParticipants: 50,
      isPublic: true,
      tags: ['combat', 'large-scale', 'stanton'],
      teamId: 'team-alpha',
    };
    assertType<CreateActivityRequest>(full);
    expect(full.maxParticipants).toBe(50);
    expect(full.tags).toHaveLength(3);
  });

  it('should NOT allow missing required "title" (compile-time check)', () => {
    // @ts-expect-error - missing required 'title' field
    const noTitle: CreateActivityRequest = {
      type: 'contract',
    };
    expect(noTitle).toBeDefined();
  });

  it('should NOT allow missing required "type" (compile-time check)', () => {
    // @ts-expect-error - missing required 'type' field
    const noType: CreateActivityRequest = {
      title: 'Untitled',
    };
    expect(noType).toBeDefined();
  });

  it('should NOT allow an invalid activity type (compile-time check)', () => {
    const badType: CreateActivityRequest = {
      title: 'Bad Request',
      // @ts-expect-error - 'recruitment' is not a valid ActivityType
      type: 'recruitment',
    };
    expect(badType).toBeDefined();
  });
});

describe('UpdateActivityRequest interface', () => {
  it('should accept an empty object (all fields are optional via Partial)', () => {
    const empty: UpdateActivityRequest = {};
    assertType<UpdateActivityRequest>(empty);
    expect(empty).toEqual({});
  });

  it('should accept only a status update', () => {
    const statusOnly: UpdateActivityRequest = {
      status: 'in_progress',
    };
    assertType<UpdateActivityRequest>(statusOnly);
    expect(statusOnly.status).toBe('in_progress');
  });

  it('should accept a combination of fields', () => {
    const combo: UpdateActivityRequest = {
      title: 'Updated Title',
      status: 'completed',
      maxParticipants: 20,
      tags: ['updated'],
    };
    assertType<UpdateActivityRequest>(combo);
    expect(combo.title).toBe('Updated Title');
    expect(combo.status).toBe('completed');
  });

  it('should NOT allow an invalid status (compile-time check)', () => {
    const badStatus: UpdateActivityRequest = {
      // @ts-expect-error - 'abandoned' is not a valid ActivityStatus
      status: 'abandoned',
    };
    expect(badStatus).toBeDefined();
  });
});
