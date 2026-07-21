/**
 * Shared-types ⇄ backend Loot enum parity contract (ADR-004).
 *
 * Asserts the client-facing Loot vocabularies exposed by `@sc-fleet-manager/shared-types`
 * (as runtime-introspectable `as const` arrays) stay in parity with the backend TypeORM enums that
 * are the persistence source of truth. See `enumUnionParity.helper.ts` for the boundary rule.
 *
 * Every Loot vocabulary has exact parity with its backend enum — there are no client-only
 * exclusions. The backend enums live across three entity files (`LootPool`, `LootItem`,
 * `LootClaim`).
 */
import {
  LOOT_CLAIM_STATUS_VALUES,
  LOOT_CLAIM_TYPE_VALUES,
  LOOT_DISTRIBUTION_METHOD_VALUES,
  LOOT_ITEM_CATEGORY_VALUES,
  LOOT_ITEM_SOURCE_VALUES,
  LOOT_ITEM_STATUS_VALUES,
  LOOT_POOL_STATUS_VALUES,
} from '@sc-fleet-manager/shared-types';
import { LootClaimStatus, LootClaimType } from '../../models/LootClaim';
import { LootItemCategory, LootItemSource, LootItemStatus } from '../../models/LootItem';
import { LootDistributionMethod, LootPoolStatus } from '../../models/LootPool';
import { assertEnumUnionParity } from './enumUnionParity.helper';

describe('shared-types ⇄ backend Loot enum parity (ADR-004)', () => {
  it('LootPoolStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LootPoolStatus', LootPoolStatus, LOOT_POOL_STATUS_VALUES, []);
  });

  it('LootDistributionMethod: shared values match backend enum exactly', () => {
    assertEnumUnionParity(
      'LootDistributionMethod',
      LootDistributionMethod,
      LOOT_DISTRIBUTION_METHOD_VALUES,
      []
    );
  });

  it('LootItemCategory: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LootItemCategory', LootItemCategory, LOOT_ITEM_CATEGORY_VALUES, []);
  });

  it('LootItemStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LootItemStatus', LootItemStatus, LOOT_ITEM_STATUS_VALUES, []);
  });

  it('LootItemSource: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LootItemSource', LootItemSource, LOOT_ITEM_SOURCE_VALUES, []);
  });

  it('LootClaimType: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LootClaimType', LootClaimType, LOOT_CLAIM_TYPE_VALUES, []);
  });

  it('LootClaimStatus: shared values match backend enum exactly', () => {
    assertEnumUnionParity('LootClaimStatus', LootClaimStatus, LOOT_CLAIM_STATUS_VALUES, []);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
