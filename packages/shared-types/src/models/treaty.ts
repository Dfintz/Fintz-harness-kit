/**
 * Treaty Template — Shared Types
 *
 * Reusable treaty agreement templates for alliances and federations.
 * Organizations can create custom templates or use built-in ones.
 *
 * @module treaty
 */

// ─── Enums / Literal Unions ────────────────────────────────────

/**
 * Category of the treaty template.
 * Matches alliance and federation treaty type systems.
 */
export type TreatyTemplateCategory =
  | 'mutual_defense'
  | 'trade'
  | 'non_aggression'
  | 'resource_sharing'
  | 'intel_sharing'
  | 'military_cooperation'
  | 'custom';

/**
 * Where the template can be used.
 * - `alliance`: For bilateral org-to-org diplomacy (AllianceDiplomacy)
 * - `federation`: For multi-org federation treaties
 * - `both`: Usable in either context
 */
export type TreatyTemplateScope = 'alliance' | 'federation' | 'both';

// ─── Clause ────────────────────────────────────────────────────

/**
 * A single clause within a treaty template.
 * Templates contain an ordered list of clauses that define the agreement terms.
 */
export interface TreatyClause {
  /** Unique ID within the template */
  id: string;
  /** Short title of the clause (e.g., "Mutual Defense Obligation") */
  title: string;
  /** Full text of the clause */
  text: string;
  /** Whether this clause is mandatory (cannot be removed when using the template) */
  isRequired: boolean;
  /** Display order within the template */
  sortOrder: number;
}

// ─── Treaty Template ───────────────────────────────────────────

/**
 * A reusable treaty template that can be used to create alliance or federation agreements.
 */
export interface TreatyTemplate {
  id: string;
  /** Human-readable name of the template */
  name: string;
  /** Description of when/how to use this template */
  description: string;
  /** Category of agreement */
  category: TreatyTemplateCategory;
  /** Where this template can be applied */
  scope: TreatyTemplateScope;
  /** Ordered list of clauses */
  clauses: TreatyClause[];
  /** Whether this is a system-provided built-in template */
  isBuiltIn: boolean;
  /** Organization that created this template (null for built-in) */
  organizationId: string | null;
  /** Whether the template is published and available for use */
  isPublished: boolean;
  /** Version number for tracking template revisions */
  version: number;
  /** Tags for discoverability */
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Request DTOs ──────────────────────────────────────────────

/**
 * Request to create a new treaty template.
 */
export interface CreateTreatyTemplateRequest {
  name: string;
  description: string;
  category: TreatyTemplateCategory;
  scope: TreatyTemplateScope;
  clauses: Array<Omit<TreatyClause, 'id'>>;
  isPublished?: boolean;
  tags?: string[];
}

/**
 * Request to update an existing treaty template.
 */
export interface UpdateTreatyTemplateRequest {
  name?: string;
  description?: string;
  category?: TreatyTemplateCategory;
  scope?: TreatyTemplateScope;
  clauses?: Array<Omit<TreatyClause, 'id'>>;
  isPublished?: boolean;
  tags?: string[];
}

/**
 * Request to instantiate a treaty from a template, producing actual terms
 * for use in an alliance or federation agreement.
 */
export interface InstantiateTreatyRequest {
  /** The template to use */
  templateId: string;
  /** Override clause text for specific clauses (by clause title) */
  clauseOverrides?: Record<string, string>;
  /** Additional custom clauses to append */
  additionalClauses?: Array<{ title: string; text: string }>;
  /** Clauses to exclude (by title, only non-required clauses) */
  excludeClauses?: string[];
}
