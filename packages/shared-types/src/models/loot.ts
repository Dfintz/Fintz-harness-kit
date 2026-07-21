/**
 * Loot distribution types — shared between frontend and backend.
 *
 * The commissary loot distribution feature lets a mission leader collect looted
 * gear / components / commodities from an activity, calculate the total value,
 * set distribution rules, and have eligible participants claim or bid on items.
 *
 * Per ADR-004, each vocabulary is exposed as a runtime-introspectable `as const`
 * array plus a derived union type, so the values can be enumerated at runtime and
 * verified against the backend loot enums by a contract test. Each set has exact
 * parity with its backend enum (no client-only exclusions).
 */

/** Canonical loot-pool status values (runtime source set for {@link LootPoolStatus}). */
export const LOOT_POOL_STATUS_VALUES = [
  'open',
  'locked',
  'distributed',
  'partially_distributed',
  'cancelled',
] as const;

/** Lifecycle of a loot pool. */
export type LootPoolStatus = (typeof LOOT_POOL_STATUS_VALUES)[number];

/** Canonical loot-distribution-method values (runtime source set for {@link LootDistributionMethod}). */
export const LOOT_DISTRIBUTION_METHOD_VALUES = [
  'need_greed',
  'random_roll',
  'auec_bid',
  'even_split',
  'leader_assign',
] as const;

/** How the loot is divided amongst participants who were active. */
export type LootDistributionMethod = (typeof LOOT_DISTRIBUTION_METHOD_VALUES)[number];

/** Canonical loot-item-category values (runtime source set for {@link LootItemCategory}). */
export const LOOT_ITEM_CATEGORY_VALUES = [
  'gear',
  'component',
  'commodity',
  'weapon',
  'ship',
  'other',
] as const;

export type LootItemCategory = (typeof LOOT_ITEM_CATEGORY_VALUES)[number];

/** Canonical loot-item-status values (runtime source set for {@link LootItemStatus}). */
export const LOOT_ITEM_STATUS_VALUES = ['available', 'awarded'] as const;

export type LootItemStatus = (typeof LOOT_ITEM_STATUS_VALUES)[number];

/** Canonical loot-item-source values (runtime source set for {@link LootItemSource}). */
export const LOOT_ITEM_SOURCE_VALUES = ['manual', 'ocr'] as const;

export type LootItemSource = (typeof LOOT_ITEM_SOURCE_VALUES)[number];

/** Canonical loot-claim-type values (runtime source set for {@link LootClaimType}). */
export const LOOT_CLAIM_TYPE_VALUES = ['need', 'greed', 'roll', 'bid'] as const;

export type LootClaimType = (typeof LOOT_CLAIM_TYPE_VALUES)[number];

/** Canonical loot-claim-status values (runtime source set for {@link LootClaimStatus}). */
export const LOOT_CLAIM_STATUS_VALUES = ['pending', 'won', 'lost', 'withdrawn'] as const;

export type LootClaimStatus = (typeof LOOT_CLAIM_STATUS_VALUES)[number];

/** Optional rule configuration set by the mission leader. */
export interface LootPoolRules {
  /** Cap on how many items a single participant may win (e.g. "one item each"). */
  maxItemsPerParticipant?: number;
  /** EVEN_SPLIT: pay out the total value from the org pool, shared between participants. */
  shareTotalPayout?: boolean;
  /** Per-role weighting for EVEN_SPLIT shares (defaults to equal). */
  roleWeights?: Record<string, number>;
  /** Only participants with these roles may claim (empty = everyone). */
  eligibleRoles?: string[];
  /** ISO timestamp after which bids/claims are closed. */
  closesAt?: string;
  /** Minimum bid increment for AUEC_BID. */
  minBidIncrement?: number;
  /** Free-form leader notes shown to participants. */
  notes?: string;
}

export interface LootItem {
  id: string;
  organizationId: string;
  lootPoolId: string;
  name: string;
  category: LootItemCategory;
  quantity: number;
  unitValue: number;
  totalValue: number;
  status: LootItemStatus;
  source: LootItemSource;
  awardedToUserId?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LootClaim {
  id: string;
  organizationId: string;
  lootPoolId: string;
  lootItemId: string;
  userId: string;
  userName: string;
  claimType: LootClaimType;
  bidAmount?: number;
  rollValue?: number;
  status: LootClaimStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface LootPoolMetadata extends Record<string, unknown> {
  assistantUserIds?: string[];
}

export interface LootPool {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  activityId: string;
  missionId?: string;
  lfgSessionId?: string;
  status: LootPoolStatus;
  distributionMethod: LootDistributionMethod;
  rules?: LootPoolRules;
  totalValue: number;
  currency: string;
  leaderId: string;
  createdBy: string;
  distributedAt?: string | Date;
  metadata?: LootPoolMetadata;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** A pool with its items (and optionally the requester's own claims) hydrated. */
export interface LootPoolDetail extends LootPool {
  items: LootItem[];
  claims?: LootClaim[];
}

/** A single item-level award produced by a distribution run. */
export interface LootDistributionAward {
  lootItemId: string;
  itemName: string;
  userId?: string;
  userName?: string;
  /** aUEC paid (bid) or received (even split share). */
  amount?: number;
  rollValue?: number;
  claimType?: LootClaimType;
}

/** A settlement or payout that failed while distributing a pool. */
export interface LootDistributionFailure {
  lootItemId?: string;
  itemName?: string;
  userId?: string;
  userName?: string;
  amount?: number;
  stage: 'settlement' | 'payout';
  reason: string;
}

/** Result summary returned after distributing a pool. */
export interface LootDistributionResult {
  poolId: string;
  distributionMethod: LootDistributionMethod;
  totalValue: number;
  currency: string;
  awards: LootDistributionAward[];
  /** Per-participant aUEC payout for EVEN_SPLIT (userId -> amount). */
  payouts?: Array<{ userId: string; userName?: string; amount: number }>;
  /** Settlement/payout operations that failed during this distribution run. */
  failures?: LootDistributionFailure[];
}

/** A single OCR-detected candidate item (not yet persisted). */
export interface LootOcrSuggestion {
  name: string;
  quantity: number;
  category?: LootItemCategory;
  /** OCR confidence 0-1, when available. */
  confidence?: number;
}

export interface LootOcrResult {
  suggestions: LootOcrSuggestion[];
  /** Raw text lines, for debugging / manual correction. */
  rawLines: string[];
  provider: string;
  /** False when OCR is not configured; suggestions will be empty. */
  enabled: boolean;
}
