import { Client, ActivityType as DiscordActivityType } from 'discord.js';

import { AppDataSource } from '../../config/database';
import { Federation } from '../../models/Federation';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { rsiStatusService } from '../external/RsiStatusService';
import { OpportunitySearchService } from '../search/OpportunitySearchService';

/** How often (ms) to refresh the bot's presence status */
const PRESENCE_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/** Rotate through different stat lines every cycle */
const STAT_LINES = ['users', 'orgs', 'federations', 'opportunities', 'rsiServerStatus'] as const;
const RSI_SERVER_COMPONENT_LABEL = 'Persistent Universe';

type StatLine = (typeof STAT_LINES)[number];

interface PlatformStats {
  users: number;
  orgs: number;
  federations: number;
  opportunities: number;
  rsiServerStatus: string;
}

/**
 * Manages the bot's own Discord Rich Presence.
 *
 * Periodically queries platform-wide public counts (users, orgs,
 * federations, open opportunities) and rotates the bot's status
 * to showcase them. The opportunity count is sourced from the same
 * service as the public /opportunities directory to keep them in sync.
 */
export class BotPresenceService {
  private static instance: BotPresenceService;
  private client: Client | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private currentIndex = 0;
  private cachedStats: PlatformStats = {
    users: 0,
    orgs: 0,
    federations: 0,
    opportunities: 0,
    rsiServerStatus: 'Unknown',
  };
  /** Lazily constructed so it never touches the DB before AppDataSource is initialized. */
  private opportunitySearchService: OpportunitySearchService | null = null;

  static getInstance(): BotPresenceService {
    if (!BotPresenceService.instance) {
      BotPresenceService.instance = new BotPresenceService();
    }
    return BotPresenceService.instance;
  }

  /**
   * Start the presence rotation. Call once from clientReady.
   */
  initialize(client: Client): void {
    this.client = client;

    // First update after a short delay (let DB connections settle)
    setTimeout(() => void this.refreshPresence(), 10_000);

    // Rotate every PRESENCE_REFRESH_INTERVAL
    this.refreshInterval = setInterval(() => {
      void this.refreshPresence();
    }, PRESENCE_REFRESH_INTERVAL);

    logger.info('🤖 BotPresenceService initialized — rotating platform stats');
  }

  /**
   * Stop background refresh. Called during graceful shutdown.
   */
  shutdown(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    logger.info('🤖 BotPresenceService shut down');
  }

  // ── Private helpers ─────────────────────────────────────────────

  /**
   * Lazily construct the opportunity search service. Deferred until first use so it (and
   * its ActivityService repository lookups) is only built after the database connection
   * is initialized.
   */
  private getOpportunitySearchService(): OpportunitySearchService {
    this.opportunitySearchService ??= new OpportunitySearchService();
    return this.opportunitySearchService;
  }

  /**
   * Fetch fresh stats from the database and update the bot presence.
   */
  private async refreshPresence(): Promise<void> {
    try {
      await this.fetchStats();
    } catch (err: unknown) {
      logger.warn('BotPresenceService: Failed to fetch platform stats (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      await this.fetchRsiServerStatus();
    } catch (err: unknown) {
      logger.warn('BotPresenceService: Failed to fetch RSI server status (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.setPresence();

    // Advance to next stat line for the next cycle
    this.currentIndex = (this.currentIndex + 1) % STAT_LINES.length;
  }

  /**
   * Query the database for public platform counts.
   */
  private async fetchStats(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      return;
    }

    const [users, orgs, federations, opportunities] = await Promise.all([
      AppDataSource.getRepository(User).count(),
      AppDataSource.getRepository(PublicOrgProfile).count({ where: { isPublic: true } }),
      AppDataSource.getRepository(Federation).count({ where: { isPublic: true } }),
      // Delegate to the search service that powers the public /opportunities directory and the
      // /discover command so the advertised count always matches what users can actually browse.
      this.getOpportunitySearchService().countOpportunities(),
    ]);

    this.cachedStats = { ...this.cachedStats, users, orgs, federations, opportunities };
  }

  /**
   * Query RSI status and capture the current Persistent Universe status.
   */
  private async fetchRsiServerStatus(): Promise<void> {
    const status = await rsiStatusService.getStatus();
    const server = status.components.find(
      component => component.name.toLowerCase() === RSI_SERVER_COMPONENT_LABEL.toLowerCase()
    );
    const normalizedStatus = server?.status?.trim();

    this.cachedStats = {
      ...this.cachedStats,
      rsiServerStatus:
        normalizedStatus && normalizedStatus.length > 0 ? normalizedStatus : 'Unknown',
    };
  }

  /**
   * Apply the current stat line to the bot's Discord presence.
   */
  private setPresence(): void {
    if (!this.client?.user) {
      return;
    }

    const line = STAT_LINES[this.currentIndex];
    const text = this.formatStatLine(line);

    this.client.user.setPresence({
      status: 'online',
      activities: [
        {
          name: text,
          type: DiscordActivityType.Watching,
        },
      ],
    });
  }

  /**
   * Build a human-friendly string for a given stat category.
   */
  private formatStatLine(line: StatLine): string {
    const s = this.cachedStats;
    switch (line) {
      case 'users':
        return `${s.users.toLocaleString()} pilots`;
      case 'orgs':
        return `${s.orgs.toLocaleString()} organizations`;
      case 'federations':
        return `${s.federations.toLocaleString()} federations`;
      case 'opportunities':
        return `${s.opportunities.toLocaleString()} open opportunities`;
      case 'rsiServerStatus':
        return `${RSI_SERVER_COMPONENT_LABEL}: ${s.rsiServerStatus}`;
    }
  }
}

