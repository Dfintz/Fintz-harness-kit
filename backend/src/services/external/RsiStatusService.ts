import axios from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';

import { logger } from '../../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────

export interface RsiComponentStatus {
  name: string;
  status: string;
}

export interface RsiIncident {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  resolved: boolean;
  category?: string;
}

export interface RsiStatusSnapshot {
  components: RsiComponentStatus[];
  overallStatus: string;
  latestIncident: RsiIncident | null;
  fetchedAt: Date;
}

// ─── Service ───────────────────────────────────────────────────────

const RSS_URL = 'https://status.robertsspaceindustries.com/index.xml';
const STATUS_PAGE_URL = 'https://status.robertsspaceindustries.com/';
const CACHE_KEY = 'rsi_status_snapshot';
const CACHE_TTL_SECONDS = 120; // 2 minutes

/**
 * Fetches and parses the RSI Status page (cstate-based).
 * Uses the RSS feed for incident data and scrapes the main page
 * for per-component operational status.
 */
export class RsiStatusService {
  private static instance: RsiStatusService;
  private cache: NodeCache;

  private constructor() {
    this.cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS });
  }

  static getInstance(): RsiStatusService {
    if (!RsiStatusService.instance) {
      RsiStatusService.instance = new RsiStatusService();
    }
    return RsiStatusService.instance;
  }

  /**
   * Returns the current RSI status snapshot, cached for 2 minutes.
   */
  async getStatus(): Promise<RsiStatusSnapshot> {
    const cached = this.cache.get<RsiStatusSnapshot>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    const [components, latestIncident] = await Promise.all([
      this.fetchComponentStatuses(),
      this.fetchLatestIncident(),
    ]);

    const hasIssue = components.some(c => c.status.toLowerCase() !== 'operational');

    const snapshot: RsiStatusSnapshot = {
      components,
      overallStatus: hasIssue ? 'Degraded' : 'All Systems Operational',
      latestIncident,
      fetchedAt: new Date(),
    };

    this.cache.set(CACHE_KEY, snapshot);
    return snapshot;
  }

  /**
   * Invalidates the cache so the next call fetches fresh data.
   */
  invalidateCache(): void {
    this.cache.del(CACHE_KEY);
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async fetchComponentStatuses(): Promise<RsiComponentStatus[]> {
    try {
      const { data: html } = await axios.get<string>(STATUS_PAGE_URL, {
        timeout: 10_000,
        headers: { 'User-Agent': 'SCFleetManager/1.0 StatusBot' },
      });

      return this.parseComponentStatuses(html);
    } catch (error: unknown) {
      logger.warn('RsiStatusService: Failed to fetch component statuses', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private parseComponentStatuses(html: string): RsiComponentStatus[] {
    const knownComponents = ['Platform', 'Persistent Universe', 'Arena Commander'];
    const textContent = cheerio
      .load(html)
      .text()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return knownComponents.map(name => ({
      name,
      status:
        this.extractStatusFromTextSummary(textContent, name) ??
        this.extractStatusNearComponentName(html, name) ??
        'Unknown',
    }));
  }

  private extractStatusFromTextSummary(textContent: string, componentName: string): string | null {
    const escapedName = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statusMatch = new RegExp(
      `${escapedName}\\s*(Operational|Maintenance|Degraded(?:\\s+Performance)?|Partial(?:\\s+Outage)?|Major\\s+Outage|Outage|Unknown)`,
      'i'
    ).exec(textContent);

    return this.toCanonicalStatus(statusMatch?.[1]);
  }

  private extractStatusNearComponentName(html: string, componentName: string): string | null {
    const lowerHtml = html.toLowerCase();
    const lowerName = componentName.toLowerCase();
    const searchRadius = 90;

    let searchIndex = 0;
    while (searchIndex < lowerHtml.length) {
      const matchIndex = lowerHtml.indexOf(lowerName, searchIndex);
      if (matchIndex === -1) {
        break;
      }

      const afterSlice = lowerHtml.slice(
        matchIndex + lowerName.length,
        matchIndex + lowerName.length + searchRadius
      );
      const beforeSlice = lowerHtml.slice(Math.max(0, matchIndex - searchRadius), matchIndex);

      const afterStatus = this.extractStatusToken(afterSlice);
      if (afterStatus) {
        return afterStatus;
      }

      const beforeStatus = this.extractStatusToken(beforeSlice);
      if (beforeStatus) {
        return beforeStatus;
      }

      searchIndex = matchIndex + lowerName.length;
    }

    return null;
  }

  private extractStatusToken(source: string): string | null {
    const statusMatch =
      /(operational|maintenance|degraded(?:\s+performance)?|partial(?:\s+outage)?|major\s+outage|outage|unknown)/i.exec(
        source
      );

    return this.toCanonicalStatus(statusMatch?.[1]);
  }

  private toCanonicalStatus(status: string | undefined): string | null {
    if (!status) {
      return null;
    }

    const normalized = status.toLowerCase().trim();
    if (normalized.startsWith('operational')) {
      return 'Operational';
    }
    if (normalized.startsWith('maintenance')) {
      return 'Maintenance';
    }
    if (normalized.startsWith('degraded')) {
      return 'Degraded';
    }
    if (normalized.startsWith('partial')) {
      return 'Partial Outage';
    }
    if (normalized.includes('major outage') || normalized === 'outage') {
      return 'Major Outage';
    }
    if (normalized.startsWith('unknown')) {
      return 'Unknown';
    }

    return null;
  }

  private async fetchLatestIncident(): Promise<RsiIncident | null> {
    try {
      const { data: xml } = await axios.get<string>(RSS_URL, {
        timeout: 10_000,
        headers: { 'User-Agent': 'SCFleetManager/1.0 StatusBot' },
      });

      return this.parseLatestIncident(xml);
    } catch (error: unknown) {
      logger.warn('RsiStatusService: Failed to fetch RSS feed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private parseLatestIncident(xml: string): RsiIncident | null {
    try {
      const $ = cheerio.load(xml, { xml: true });
      const firstItem = $('item').first();

      if (firstItem.length === 0) {
        return null;
      }

      const title = firstItem.find('title').text().trim();
      const resolved = title.startsWith('[Resolved]');

      // Strip HTML tags from description for a clean text summary
      const rawDesc = firstItem.find('description').text().trim();
      const cleanDesc = rawDesc
        .replace(/<[^>]+>/g, '') // strip HTML tags
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim()
        .slice(0, 1000); // limit length

      return {
        title: title.replace('[Resolved] ', '').replace('[Resolved]', '').trim(),
        link: firstItem.find('link').text().trim(),
        pubDate: firstItem.find('pubDate').text().trim(),
        description: cleanDesc,
        resolved,
        category: firstItem.find('category').text().trim() || undefined,
      };
    } catch (error: unknown) {
      logger.warn('RsiStatusService: Failed to parse RSS feed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export const rsiStatusService = RsiStatusService.getInstance();

