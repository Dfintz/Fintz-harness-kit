/**
 * Wiki (Org Knowledge Base) — Shared Types
 *
 * Collaborative wiki with Markdown content, hierarchical page tree,
 * full-text search (tsvector), and revision history.
 *
 * @module wiki
 */

// ─── Core Interfaces ──────────────────────────────────────────

export interface WikiPage {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  content: string;
  parentPageId?: string | null;
  sortOrder: number;
  tags: string[];
  version: number;
  isLocked: boolean;
  createdBy: string;
  lastEditedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPageRevision {
  id: string;
  pageId: string;
  content: string;
  editedBy: string;
  changeDescription?: string | null;
  version: number;
  editedAt: string;
}

// ─── Tree ──────────────────────────────────────────────────────

export interface WikiTreeNode extends WikiPage {
  children: WikiTreeNode[];
}

// ─── Request DTOs ──────────────────────────────────────────────

export interface CreateWikiPageRequest {
  title: string;
  content?: string;
  parentPageId?: string | null;
  tags?: string[];
}

export interface UpdateWikiPageRequest {
  title?: string;
  content?: string;
  tags?: string[];
  changeDescription?: string;
  isLocked?: boolean;
}

export interface MoveWikiPageRequest {
  parentPageId: string | null;
  sortOrder: number;
}

// ─── Search ────────────────────────────────────────────────────

export interface WikiSearchResult {
  id: string;
  title: string;
  slug: string;
  snippet: string;
  rank: number;
  updatedAt: string;
}
