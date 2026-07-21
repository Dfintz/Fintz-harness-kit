/**
 * Shared-types ⇄ backend Mission enum parity contract (ADR-004).
 *
 * Asserts the client-facing Mission vocabularies exposed by `@sc-fleet-manager/shared-types`
 * (as runtime-introspectable `as const` arrays) stay in parity with the backend TypeORM enums that
 * are the persistence source of truth. See `enumUnionParity.helper.ts` for the boundary rule.
 *
 * Unlike Activity, every Mission vocabulary has exact parity with its backend enum — there are no
 * client-only exclusions.
 */
import {
  MISSION_DIFFICULTY_VALUES,
  MISSION_PRIORITY_VALUES,
  MISSION_STATUS_VALUES,
  MISSION_TYPE_VALUES,
} from '@sc-fleet-manager/shared-types';
import {
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../models/Mission';
import { assertEnumUnionParity } from './enumUnionParity.helper';

describe('shared-types ⇄ backend Mission enum parity (ADR-004)', () => {
  it('MissionType: shared values match backend enum exactly', () => {
    assertEnumUnionParity('MissionType', MissionType, MISSION_TYPE_VALUES, []);
  });

  it('MissionStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('MissionStatus', MissionStatus, MISSION_STATUS_VALUES, []);
  });

  it('MissionDifficulty: shared values match backend enum exactly', () => {
    assertEnumUnionParity('MissionDifficulty', MissionDifficulty, MISSION_DIFFICULTY_VALUES, []);
  });

  it('MissionPriority: shared values match backend enum exactly', () => {
    assertEnumUnionParity('MissionPriority', MissionPriority, MISSION_PRIORITY_VALUES, []);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
