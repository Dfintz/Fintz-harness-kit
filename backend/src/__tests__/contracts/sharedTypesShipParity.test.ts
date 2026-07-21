/**
 * Shared-types ⇄ backend Ship enum parity contract (ADR-004).
 *
 * Asserts the client-facing ship-size vocabulary exposed by `@sc-fleet-manager/shared-types`
 * (`SHIP_SIZE_VALUES`, an `as const` array) stays in parity with the backend TypeORM
 * `Ship.ShipSize` enum that is the persistence source of truth. See `enumUnionParity.helper.ts`
 * for the boundary rule.
 *
 * `ShipSize` has exact parity with its backend enum — there are no client-only exclusions.
 *
 * NOTE: the shared-types `Ship.ShipStatus` / `ShipRole` unions are intentionally NOT covered here:
 * they describe user-owned ship-instance state (e.g. `ACTIVE`/`MAINTENANCE`) and capability roles,
 * which are distinct from the backend `Ship.ShipStatus` production enum
 * (`flight_ready`/`in_concept`/…) — there is no enum to assert parity against.
 */
import { SHIP_SIZE_VALUES } from '@sc-fleet-manager/shared-types';
import { ShipSize } from '../../models/Ship';
import { assertEnumUnionParity } from './enumUnionParity.helper';

describe('shared-types ⇄ backend Ship enum parity (ADR-004)', () => {
  it('ShipSize: shared values match backend enum exactly', () => {
    assertEnumUnionParity('ShipSize', ShipSize, SHIP_SIZE_VALUES, []);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
