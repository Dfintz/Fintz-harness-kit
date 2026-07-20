/**
 * Wiki React Query Hooks
 * TanStack React Query hooks for wiki CRUD, tree, search, and revisions
 *
 * Created during Sprint 2 — Wave 3.2 (Org Wiki)
 */

import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateWikiPageRequest,
  MoveWikiPageRequest,
  UpdateWikiPageRequest,
  WikiPage,
  WikiPageRevision,
  WikiSearchResult,
  WikiTreeNode,
} from '@sc-fleet-manager/shared-types';

import { wikiService } from '@/services/wikiService';
import { wikiKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch hierarchical wiki page tree
 */
export function useWikiTree(
  options?: Omit<UseQueryOptions<WikiTreeNode[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: wikiKeys.tree(),
    queryFn: () => wikiService.getPageTree(),
    staleTime: 2 * 60 * 1000, // 2 minutes — tree doesn't change often
    ...options,
  });
}

/**
 * Fetch a single wiki page by ID or slug
 */
export function useWikiPage(
  pageIdOrSlug: string | undefined,
  options?: Omit<UseQueryOptions<WikiPage>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: wikiKeys.detail(pageIdOrSlug!),
    queryFn: () => wikiService.getPage(pageIdOrSlug!),
    enabled: !!pageIdOrSlug,
    ...options,
  });
}

/**
 * Fetch flat list of all wiki pages
 */
export function useWikiPages(options?: Omit<UseQueryOptions<WikiPage[]>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryKey: wikiKeys.lists(),
    queryFn: () => wikiService.getPages(),
    ...options,
  });
}

/**
 * Search wiki pages by content/title
 */
export function useWikiSearch(
  query: string,
  options?: Omit<UseQueryOptions<WikiSearchResult[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: wikiKeys.search(query),
    queryFn: () => wikiService.searchPages(query),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000, // 30 seconds for search results
    ...options,
  });
}

/**
 * Fetch revisions for a wiki page
 */
export function useWikiRevisions(
  pageId: string | undefined,
  options?: Omit<UseQueryOptions<WikiPageRevision[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: wikiKeys.revisions(pageId!),
    queryFn: () => wikiService.getRevisions(pageId!),
    enabled: !!pageId,
    ...options,
  });
}

/**
 * Fetch a single revision
 */
export function useWikiRevision(
  pageId: string | undefined,
  revisionId: string | undefined,
  options?: Omit<UseQueryOptions<WikiPageRevision>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: wikiKeys.revision(pageId!, revisionId!),
    queryFn: () => wikiService.getRevision(pageId!, revisionId!),
    enabled: !!pageId && !!revisionId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new wiki page
 */
export function useCreateWikiPage() {  return useMutation({
    mutationFn: (data: CreateWikiPageRequest) => wikiService.createPage(data),
    meta: { invalidates: [wikiKeys.tree(), wikiKeys.lists()] },
  });
}

/**
 * Update a wiki page
 */
export function useUpdateWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, data }: { pageId: string; data: UpdateWikiPageRequest }) =>
      wikiService.updatePage(pageId, data),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: wikiKeys.detail(pageId) });
      queryClient.invalidateQueries({ queryKey: wikiKeys.tree() });
      queryClient.invalidateQueries({ queryKey: wikiKeys.lists() });
    },
  });
}

/**
 * Delete a wiki page (soft delete)
 */
export function useDeleteWikiPage() {  return useMutation({
    mutationFn: (pageId: string) => wikiService.deletePage(pageId),
    meta: { invalidates: [wikiKeys.tree(), wikiKeys.lists()] },
  });
}

/**
 * Move a wiki page within the tree
 */
export function useMoveWikiPage() {  return useMutation({
    mutationFn: ({ pageId, data }: { pageId: string; data: MoveWikiPageRequest }) =>
      wikiService.movePage(pageId, data),
    meta: { invalidates: [wikiKeys.tree(), wikiKeys.lists()] },
  });
}

/**
 * Restore a past revision as the current content
 */
export function useRestoreWikiRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, revisionId }: { pageId: string; revisionId: string }) =>
      wikiService.restoreRevision(pageId, revisionId),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: wikiKeys.detail(pageId) });
      queryClient.invalidateQueries({ queryKey: wikiKeys.revisions(pageId) });
      queryClient.invalidateQueries({ queryKey: wikiKeys.tree() });
    },
  });
}

// ============================================================================
// Prefetch Hooks
// ============================================================================

/**
 * Prefetch a wiki page for navigation preloading
 */
export function usePrefetchWikiPage() {
  const queryClient = useQueryClient();
  return (pageIdOrSlug: string) => {
    queryClient.prefetchQuery({
      queryKey: wikiKeys.detail(pageIdOrSlug),
      queryFn: () => wikiService.getPage(pageIdOrSlug),
      staleTime: 5 * 60 * 1000,
    });
  };
}
