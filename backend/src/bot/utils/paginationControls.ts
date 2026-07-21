import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Shared pagination primitive (C2 / CMD-03).
 *
 * Discord bot list embeds historically capped at the first N items with only a
 * "Showing N of X" footer and no way to see the rest. This module is the single
 * source of truth for paged list navigation so every domain presents the same
 * Previous / page-indicator / Next control instead of bespoke (or absent) paging.
 *
 * Two pure pieces, mirroring the confirmation primitive's split:
 *  - {@link paginate} slices an in-memory array for a given page (clamping the page
 *    into range and reporting totals).
 *  - {@link buildPaginationRow} builds the navigation action row. customIds are
 *    caller-supplied via {@link PaginationRowOptions.makeCustomId} because each
 *    domain owns its own customId -> handler routing (see `interactionRouter`
 *    prefix map); keeping the domain prefix as the first segment (e.g.
 *    `ticket_listpage_<n>`) is what makes the page clicks route correctly.
 */

/** Result of paginating an in-memory collection. */
export interface PaginateResult<T> {
  /** The items belonging to the (clamped) requested page. */
  pageItems: T[];
  /** The requested page after clamping into `[0, totalPages - 1]` (0-based). */
  page: number;
  /** Total number of pages (always at least 1, even when empty). */
  totalPages: number;
  /** Total number of items across all pages. */
  total: number;
}

/**
 * Slice an in-memory collection for a 0-based page. The requested page is clamped
 * into range so an out-of-bounds customId (e.g. a stale button) can never throw or
 * render an empty page mid-list.
 */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): PaginateResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: clampedPage,
    totalPages,
    total,
  };
}

/** customId for the (disabled) page-indicator button. Never clicked. */
const PAGE_INDICATOR_CUSTOM_ID = 'pagination_indicator_noop';

/** Options describing a pagination navigation row. */
export interface PaginationRowOptions {
  /** Current 0-based page (should already be clamped, e.g. from {@link paginate}). */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /**
   * Builds the customId for the Previous/Next buttons given a target page. Must
   * keep the domain's routing prefix as the first segment (e.g.
   * `ticket_listpage_<n>`) so the click routes back to the owning command handler.
   */
  makeCustomId: (targetPage: number) => string;
  /** Previous button label. Defaults to `'Previous'`. */
  prevLabel?: string;
  /** Next button label. Defaults to `'Next'`. */
  nextLabel?: string;
}

/**
 * Build the pagination navigation row: Previous | "Page X / Y" | Next.
 *
 * Returns `null` when there is at most one page (no controls needed), so callers
 * can spread `components: row ? [row] : []`. Previous is disabled on the first
 * page and Next on the last; the centre button is a disabled page indicator.
 */
export function buildPaginationRow(
  options: PaginationRowOptions
): ActionRowBuilder<ButtonBuilder> | null {
  const { page, totalPages, makeCustomId, prevLabel = 'Previous', nextLabel = 'Next' } = options;

  if (totalPages <= 1) {
    return null;
  }

  const previousButton = new ButtonBuilder()
    .setCustomId(makeCustomId(page - 1))
    .setLabel(prevLabel)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('◀️')
    .setDisabled(page <= 0);

  const indicatorButton = new ButtonBuilder()
    .setCustomId(PAGE_INDICATOR_CUSTOM_ID)
    .setLabel(`Page ${page + 1} / ${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId(makeCustomId(page + 1))
    .setLabel(nextLabel)
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('▶️')
    .setDisabled(page >= totalPages - 1);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    previousButton,
    indicatorButton,
    nextButton
  );
}
