import axios from 'axios';

import { Briefing, BriefingClassification } from '../../models/Briefing';
import { BadRequestError, ForbiddenError, ServiceUnavailableError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';

/** Star Citizen brand blue. Mirrors the bot's `EmbedColors.SC_BLUE` (duplicated to avoid a service→bot import). */
const SC_BLUE = 0x00d4ff;
const WEBHOOK_USERNAME = 'Fringe Core Briefings';
const WEBHOOK_TIMEOUT_MS = 10_000;

/** Discord-owned webhook hosts (exact match). Mirrors ChangelogWebhookService's host list. */
const DISCORD_WEBHOOK_HOSTS = new Set(['discord.com', 'ptb.discord.com', 'canary.discord.com']);

/** Classifications too sensitive to egress to an external Discord webhook. */
const EXTERNAL_SHARE_BLOCKED_CLASSIFICATIONS: ReadonlySet<BriefingClassification> = new Set([
  BriefingClassification.SECRET,
  BriefingClassification.TOP_SECRET,
]);

// Discord embed limits (subset). The fixed truncations keep the aggregate well under the 6000 budget.
const MAX_TITLE = 250;
const MAX_DESCRIPTION = 2000;

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  username: string;
  embeds: DiscordEmbed[];
}

export interface PostBriefingContext {
  readonly organizationId: string;
  readonly userId: string;
}

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1)}…`;

/** Extract a short snippet from the briefing's first non-empty text element, if any. */
function firstTextSnippet(briefing: Briefing): string | undefined {
  for (const element of briefing.elements) {
    if (element.type === 'text' && element.data && typeof element.data === 'object') {
      const text = (element.data as { text?: unknown }).text;
      if (typeof text === 'string' && text.trim().length > 0) {
        return truncate(text.trim(), MAX_DESCRIPTION);
      }
    }
  }
  return undefined;
}

/**
 * Pure: serialize a briefing into a plain Discord embed object (no discord.js). Built from the
 * persisted Briefing fields (the entity has no prose body) plus a snippet from the first text
 * element, and length-clamped to respect Discord's embed limits.
 */
export function buildBriefingDiscordEmbed(briefing: Briefing): DiscordEmbed {
  const elementCount = briefing.elements.length;
  return {
    title: truncate(`Briefing: ${briefing.title}`, MAX_TITLE),
    description:
      firstTextSnippet(briefing) ?? `*${elementCount} element${elementCount === 1 ? '' : 's'}*`,
    color: SC_BLUE,
    fields: [
      { name: 'Classification', value: briefing.classification, inline: true },
      { name: 'Status', value: briefing.status, inline: true },
      { name: 'Elements', value: String(elementCount), inline: true },
    ],
    footer: { text: `Briefing ID: ${briefing.id}` },
    timestamp: briefing.createdAt instanceof Date ? briefing.createdAt.toISOString() : undefined,
  };
}

/**
 * Parse + validate a Discord webhook URL WITHOUT logging it (the path carries a secret token). Pinned
 * to Discord-owned https hosts + the `/api/webhooks/` path — an SSRF-complete allowlist for a public
 * host the caller cannot repoint, so no private-IP machinery (nor the shared `validateUrl`, which
 * logs the full URL) is needed.
 */
function parseDiscordWebhookUrl(webhookUrl: string): URL {
  let url: URL;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw new BadRequestError('webhookUrl must be a valid URL');
  }
  if (
    url.protocol !== 'https:' ||
    !DISCORD_WEBHOOK_HOSTS.has(url.hostname.toLowerCase()) ||
    !url.pathname.startsWith('/api/webhooks/')
  ) {
    throw new BadRequestError('webhookUrl must be an https Discord webhook URL');
  }
  return url;
}

/**
 * Delivers a briefing to a caller-supplied Discord webhook as an embed. Stateless; the webhook URL is
 * never persisted or logged (only its hostname). High-classification briefings are refused.
 */
export class BriefingDiscordWebhookService {
  async postBriefingToWebhook(
    briefing: Briefing,
    webhookUrl: string,
    ctx: PostBriefingContext
  ): Promise<void> {
    if (EXTERNAL_SHARE_BLOCKED_CLASSIFICATIONS.has(briefing.classification)) {
      throw new ForbiddenError(
        'This briefing classification cannot be shared to an external Discord webhook',
        { resource: 'briefing', action: 'share-external', resourceId: briefing.id }
      );
    }

    const url = parseDiscordWebhookUrl(webhookUrl);
    const payload: DiscordWebhookPayload = {
      username: WEBHOOK_USERNAME,
      embeds: [buildBriefingDiscordEmbed(briefing)],
    };

    try {
      // Post to the validated, normalized URL (never the raw caller input) so the
      // parseDiscordWebhookUrl allowlist is the single source of truth and there is no
      // parser differential between validation and the HTTP client (SSRF defense-in-depth).
      // deepcode ignore Ssrf: url comes from parseDiscordWebhookUrl() — https + Discord-owned
      // host allowlist (discord.com/ptb/canary) + /api/webhooks/ path only; maxRedirects:0.
      await axios.post(url.href, payload, {
        timeout: WEBHOOK_TIMEOUT_MS,
        maxRedirects: 0,
      }); // NOSONAR
    } catch (err: unknown) {
      // Log the hostname + status only — never the raw error or webhook URL (it carries a secret token).
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      logger.error('Failed to deliver briefing to Discord webhook', {
        briefingId: briefing.id,
        webhookHost: url.hostname,
        status,
      });
      throw new ServiceUnavailableError('Failed to deliver briefing to Discord');
    }

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: ctx.userId,
      resource: `briefing/${briefing.id}`,
      action: 'POST_TO_DISCORD_WEBHOOK',
      message: `Briefing "${briefing.title}" posted to a Discord webhook`,
      metadata: {
        organizationId: ctx.organizationId,
        briefingId: briefing.id,
        classification: briefing.classification,
        webhookHost: url.hostname,
      },
    });
  }
}

