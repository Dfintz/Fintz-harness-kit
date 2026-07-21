/**
 * Shared-types ⇄ backend ship-operations enum parity contract (ADR-004).
 *
 * Asserts the client-facing ship maintenance/loan vocabularies exposed by
 * `@sc-fleet-manager/shared-types` (as runtime-introspectable `as const` arrays) stay in parity
 * with the backend TypeORM enums that are the persistence source of truth. See
 * `enumUnionParity.helper.ts` for the boundary rule.
 *
 * Every ship-operations vocabulary has exact parity with its backend enum — there are no
 * client-only exclusions. The backend enums live in `ShipMaintenance` and `ShipLoan`.
 */
import {
  LOAN_STATUS_VALUES,
  MAINTENANCE_STATUS_VALUES,
  MAINTENANCE_TYPE_VALUES,
} from '@sc-fleet-manager/shared-types';
import { LoanStatus } from '../../models/ShipLoan';
import { MaintenanceStatus, MaintenanceType } from '../../models/ShipMaintenance';
import { assertEnumUnionParity } from './enumUnionParity.helper';

describe('shared-types ⇄ backend ship-operations enum parity (ADR-004)', () => {
  it('MaintenanceStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('MaintenanceStatus', MaintenanceStatus, MAINTENANCE_STATUS_VALUES, []);
  });

  it('MaintenanceType: shared values match backend enum exactly', () => {
    assertEnumUnionParity('MaintenanceType', MaintenanceType, MAINTENANCE_TYPE_VALUES, []);
  });

  it('LoanStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LoanStatus', LoanStatus, LOAN_STATUS_VALUES, []);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
