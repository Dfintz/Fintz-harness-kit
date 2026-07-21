import { Request, Response } from 'express';

import { AppDataSource } from '../config/database';
import { runPostSyncIntel } from '../jobs/rsiSyncScheduler';
import { RsiSyncSchedule } from '../models/RsiSyncSchedule';
import { rsiCrawlerDataService } from '../services/external/RsiCrawlerDataService';
import { rsiCrawlerService } from '../services/external/RsiCrawlerService';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';

/**
 * RSI Crawler Controller
 * API for crawled RSI organization data (direct web crawling, no third-party API)
 */
export class RsiCrawlerController {
  public listOrganizations = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const { organizations, total } = await rsiCrawlerDataService.listOrganizations(limit, offset);
      res.status(200).json({
        data: organizations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Failed to list crawled organizations', { error });
      res.status(500).json({ error: 'Failed to list organizations' });
    }
  };

  public getOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sid } = req.params;
      const force = parseBooleanQuery(req.query.force);
      const org = await rsiCrawlerDataService.fetchAndStoreOrganization(sid, force);
      res.status(200).json(org);
    } catch (error: unknown) {
      logger.error('Failed to get organization', { error });
      res.status(500).json({ error: 'Failed to get organization' });
    }
  };

  public getOrganizationMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sid } = req.params;
      const force = parseBooleanQuery(req.query.force);
      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string) || 100, 500);
      const offset = (page - 1) * limit;

      if (force) {
        await rsiCrawlerDataService.fetchAndStoreMembers(sid, true);
      }
      let { members, total } = await rsiCrawlerDataService.getMembers(sid, limit, offset);
      if (members.length === 0 && !force) {
        await rsiCrawlerDataService.fetchAndStoreMembers(sid, false);
        const result = await rsiCrawlerDataService.getMembers(sid, limit, offset);
        members = result.members;
        total = result.total;
      }
      res.status(200).json({
        data: members,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: unknown) {
      logger.error('Failed to get organization members', { error });
      res.status(500).json({ error: 'Failed to get organization members' });
    }
  };

  public getUserMemberships = async (req: Request, res: Response): Promise<void> => {
    try {
      const { handle } = req.params;
      const memberships = await rsiCrawlerDataService.getUserMemberships(handle);
      res.status(200).json(memberships);
    } catch (error: unknown) {
      logger.error('Failed to get user memberships', { error });
      res.status(500).json({ error: 'Failed to get user memberships' });
    }
  };

  public refreshOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sid } = req.params;
      const includeMembers = req.body.includeMembers !== false;
      logger.info('Manual refresh triggered for organization', { sid });
      const org = await rsiCrawlerDataService.fetchAndStoreOrganization(sid, true);
      let memberCount = 0;
      if (includeMembers) {
        const members = await rsiCrawlerDataService.fetchAndStoreMembers(sid, true);
        memberCount = members.length;
      }
      res
        .status(200)
        .json({ organization: org, membersCrawled: memberCount, refreshedAt: new Date() });

      // Post-crawl: auto-run enrich → audit → validate roles (non-blocking)
      if (includeMembers) {
        void this.runPostCrawlPipeline(sid);
      }
    } catch (error: unknown) {
      logger.error('Failed to refresh organization', { error });
      res.status(500).json({ error: 'Failed to refresh organization' });
    }
  };

  /**
   * Run enrichment, audit, and role validation after a standalone crawl.
   * Resolves the organizationId from the RSI org SID via the sync schedule.
   * Non-fatal — errors are logged but don't affect the crawl response.
   */
  private readonly runPostCrawlPipeline = async (rsiOrgSid: string): Promise<void> => {
    // Resolve organizationId and guildId from the sync schedule
    const scheduleRepo = AppDataSource.getRepository(RsiSyncSchedule);
    const schedule = await scheduleRepo.findOne({
      where: { rsiOrgSid },
      select: ['organizationId', 'guildId'],
    });

    if (!schedule) {
      logger.debug(`No sync schedule found for SID ${rsiOrgSid}, skipping post-crawl pipeline`);
      return;
    }

    await runPostSyncIntel(schedule.organizationId, schedule.guildId ?? undefined);
  };

  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await rsiCrawlerDataService.getStatistics();
      const circuitStatus = rsiCrawlerService.getCircuitStatus();
      res.status(200).json({ ...stats, circuit: circuitStatus });
    } catch (error: unknown) {
      logger.error('Failed to get crawler statistics', { error });
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  };

  public deleteOrganization = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sid } = req.params;
      await rsiCrawlerDataService.deleteOrganization(sid);
      res.status(200).json({ message: `Organization ${sid} data deleted successfully` });
    } catch (error: unknown) {
      logger.error('Failed to delete organization', { error });
      res.status(500).json({ error: 'Failed to delete organization' });
    }
  };

  public clearCache = (_req: Request, res: Response): void => {
    try {
      rsiCrawlerService.clearCache();
      res.status(200).json({ message: 'Cache cleared successfully' });
    } catch (error: unknown) {
      logger.error('Failed to clear cache', { error });
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  };

  public getMemberCountHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sid } = req.params;
      const history = await rsiCrawlerDataService.getMemberCountHistory(sid);
      res.status(200).json({ data: history });
    } catch (error: unknown) {
      logger.error('Failed to get member count history', { error });
      res.status(500).json({ error: 'Failed to get member count history' });
    }
  };
}

export const rsiCrawlerController = new RsiCrawlerController();
