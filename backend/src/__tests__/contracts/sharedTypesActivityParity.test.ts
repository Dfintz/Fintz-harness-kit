/**
 * Shared-types ⇄ backend Activity enum parity contract (ADR-004).
 *
 * Asserts the client-facing Activity vocabularies exposed by `@sc-fleet-manager/shared-types`
 * (as runtime-introspectable `as const` arrays) stay in parity with the backend TypeORM enums that
 * are the persistence source of truth. See `enumUnionParity.helper.ts` for the boundary rule.
 */
import {
  ACTIVITY_STATUS_VALUES,
  ACTIVITY_TYPE_VALUES,
  ACTIVITY_VISIBILITY_VALUES,
  PARTICIPANT_ROLE_VALUES,
} from '@sc-fleet-manager/shared-types';
import {
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ParticipantRole,
} from '../../models/Activity';
import { assertEnumUnionParity } from './enumUnionParity.helper';

describe('shared-types ⇄ backend Activity enum parity (ADR-004)', () => {
  it('ActivityType: shared values ⊆ backend enum (recruitment is backend-only)', () => {
    // `recruitment` is used internally by the recruitment subsystem and is intentionally
    // excluded from the public ActivityType union (see ADR-004 and shared-types activity.test.ts).
    assertEnumUnionParity('ActivityType', ActivityType, ACTIVITY_TYPE_VALUES, ['recruitment']);
  });

  it('ActivityStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('ActivityStatus', ActivityStatus, ACTIVITY_STATUS_VALUES, []);
  });

  it('ActivityVisibility: shared values match backend enum exactly', () => {
    assertEnumUnionParity('ActivityVisibility', ActivityVisibility, ACTIVITY_VISIBILITY_VALUES, []);
  });

  it('ParticipantRole: shared values match backend enum exactly', () => {
    assertEnumUnionParity('ParticipantRole', ParticipantRole, PARTICIPANT_ROLE_VALUES, []);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
