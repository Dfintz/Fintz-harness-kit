import { MoreThanOrEqual } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { RsiChangeEntityType, RsiChangeHistory } from '../../models/RsiChangeHistory';
import { RsiCrawledMember } from '../../models/RsiCrawledMember';
import { RsiCrawledOrganization } from '../../models/RsiCrawledOrganization';
import { logger } from '../../utils/logger';

import { rsiCrawlerService, RsiMemberData } from './RsiCrawlerService';

/**
 * RSI Crawler Data Service
 * Manages the storage and retrieval of crawled RSI data
 */
export class RsiCrawlerDataService {
  private orgRepository = AppDataSource.getRepository(RsiCrawledOrganization);
  private memberRepository = AppDataSource.getRepository(RsiCrawledMember);
  private changeRepository = AppDataSource.getRepository(RsiChangeHistory);
  private readonly memberBatchSize = 250;

  private isDegradedCrawlerFailure(message: string): boolean {
    const lowered = message.toLowerCase();
    return (
      lowered.includes('circuit breaker') ||
      lowered.includes('rate limit') ||
      lowered.includes('status code 503') ||
      lowered.includes('service unavailable') ||
      lowered.includes('failed to crawl organization: 503') ||
      lowered.includes('failed to crawl members: 503')
    );
  }

  // ========================================================================
  // Change detection helpers
  // ========================================================================

  /**
   * Compare two values and record a change if they differ.
   * Values are stringified for storage; JSON objects are sorted for
   * stable comparison.
   */
  private detectFieldChange(
    changes: RsiChangeHistory[],
    entityType: RsiChangeEntityType,
    entityId: string,
    fieldName: string,
    oldVal: unknown,
    newVal: unknown
  ): void {
    const toStr = (v: unknown): string | null => {
      if (v === undefined || v === null || v === '') {
        return null;
      }
      if (typeof v === 'object') {
        return JSON.stringify(v);
      }
      return String(v);
    };

    const oldStr = toStr(oldVal);
    const newStr = toStr(newVal);

    if (oldStr === newStr) {
      return;
    }

    const change = new RsiChangeHistory();
    change.entityType = entityType;
    change.entityId = entityId;
    change.fieldName = fieldName;
    change.oldValue = oldStr;
    change.newValue = newStr;
    changes.push(change);
  }

  /**
   * Persist an array of detected changes. Silently logs errors
   * so change tracking never breaks the main crawl flow.
   */
  private async saveChanges(changes: RsiChangeHistory[]): Promise<void> {
    if (changes.length === 0) {
      return;
    }
    try {
      await this.changeRepository.save(changes);
      logger.info(`Recorded ${changes.length} RSI change(s)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to persist RSI change history: ${msg}`);
    }
  }

  private chunkItems<T>(items: T[], size: number): T[][] {
    if (items.length === 0) {
      return [];
    }

    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  private toMemberUpsertRow(member: RsiCrawledMember): Partial<RsiCrawledMember> {
    return {
      id: member.id,
      organizationSid: member.organizationSid,
      handle: member.handle,
      displayName: member.displayName,
      rank: member.rank,
      stars: member.stars,
      isMain: member.isMain,
      isAffiliate: member.isAffiliate,
      isHidden: member.isHidden,
      isRedacted: member.isRedacted,
      avatar: member.avatar,
      enlisted: member.enlisted,
      roles: member.roles,
      firstCrawledAt: member.firstCrawledAt,
      lastCrawledAt: member.lastCrawledAt,
      crawlError: member.crawlError,
      crawlFailed: member.crawlFailed,
    };
  }

  private toChangeInsertRow(change: RsiChangeHistory): Partial<RsiChangeHistory> {
    return {
      entityType: change.entityType,
      entityId: change.entityId,
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
    };
  }

  /**
   * Fetch and store organization data
   * @param sid - Organization SID
   * @param force - Force refresh even if cached
   * @returns Promise resolving to organization data
   */
  public async fetchAndStoreOrganization(
    sid: string,
    force: boolean = false
  ): Promise<RsiCrawledOrganization> {
    try {
      // Check if we have recent data (within last hour)
      if (!force) {
        const existing = await this.orgRepository.findOne({
          where: { sid: sid.toUpperCase() },
        });

        if (existing && !existing.crawlFailed) {
          const ageMinutes = (Date.now() - existing.lastCrawledAt.getTime()) / 60000;
          if (ageMinutes < 60) {
            logger.debug(
              `Using cached organization data for ${sid} (${Math.round(ageMinutes)}m old)`
            );
            return existing;
          }
        }
      }

      // Crawl fresh data
      const crawledData = await rsiCrawlerService.crawlOrganization(sid);

      // Store or update in database
      let org = await this.orgRepository.findOne({
        where: { sid: crawledData.sid },
      });

      if (!org) {
        org = this.orgRepository.create({
          sid: crawledData.sid,
          firstCrawledAt: new Date(),
        });
      }

      // Detect changes before overwriting
      const orgChanges: RsiChangeHistory[] = [];
      if (org.lastCrawledAt) {
        // Only detect changes for existing orgs (not first crawl)
        const orgFields: Array<[string, unknown, unknown]> = [
          ['name', org.name, crawledData.name],
          ['description', org.description, crawledData.description],
          ['memberCount', org.memberCount, crawledData.memberCount],
          ['affiliateCount', org.affiliateCount, crawledData.affiliateCount],
          ['archetype', org.archetype, crawledData.archetype],
          ['commitment', org.commitment, crawledData.commitment],
          ['recruiting', org.recruiting, crawledData.recruiting],
          ['language', org.language, crawledData.language],
          ['logo', org.logo, crawledData.logo],
        ];
        for (const [field, oldVal, newVal] of orgFields) {
          this.detectFieldChange(
            orgChanges,
            'organization',
            crawledData.sid,
            field,
            oldVal,
            newVal
          );
        }
      }

      // Update fields
      org.name = crawledData.name;
      org.description = crawledData.description;
      org.banner = crawledData.banner;
      org.logo = crawledData.logo;
      org.archetype = crawledData.archetype;
      org.commitment = crawledData.commitment;
      org.roleplay = crawledData.roleplay;
      org.memberCount = crawledData.memberCount;
      org.affiliateCount = crawledData.affiliateCount;
      org.focus = crawledData.focus;
      org.recruiting = crawledData.recruiting;
      org.language = crawledData.language;
      org.exclusive = crawledData.exclusive;
      org.links = crawledData.links;
      org.crawlFailed = false;
      org.crawlError = undefined;
      org.lastCrawledAt = new Date();

      await this.orgRepository.save(org);

      // Persist detected changes (non-blocking)
      await this.saveChanges(orgChanges);

      logger.info(`Stored organization data for ${sid}`);
      return org;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.isDegradedCrawlerFailure(errorMessage)) {
        logger.warn(
          `Failed to fetch and store organization ${sid} (degraded control path): ${errorMessage}`
        );
      } else {
        logger.error(`Failed to fetch and store organization ${sid}: ${errorMessage}`);
      }

      // Try to get existing data
      const existing = await this.orgRepository.findOne({
        where: { sid: sid.toUpperCase() },
      });

      if (existing) {
        // Mark as failed but keep existing data
        existing.crawlFailed = true;
        existing.crawlError = errorMessage;
        existing.lastCrawledAt = new Date();
        await this.orgRepository.save(existing);

        logger.warn(`Using stale organization data for ${sid} due to crawl failure`);
        return existing;
      }

      throw new Error(`Failed to fetch organization data: ${errorMessage}`);
    }
  }

  /**
   * Fetch and store organization members
   * @param sid - Organization SID
   * @param force - Force refresh even if cached
   * @returns Promise resolving to array of members
   */
  public async fetchAndStoreMembers(
    sid: string,
    force: boolean = false
  ): Promise<RsiCrawledMember[]> {
    try {
      // Check if we have recent data (lightweight query — don't load all members)
      if (!force) {
        const freshCheck = await this.memberRepository.findOne({
          select: ['lastCrawledAt', 'crawlFailed'],
          where: { organizationSid: sid.toUpperCase() },
          order: { handle: 'ASC' },
        });

        if (freshCheck && !freshCheck.crawlFailed) {
          const ageMinutes = (Date.now() - freshCheck.lastCrawledAt.getTime()) / 60000;
          if (ageMinutes < 60) {
            // Data is fresh — now do the full load (we know it's cached/indexed)
            const existing = await this.memberRepository.find({
              where: { organizationSid: sid.toUpperCase() },
              order: { handle: 'ASC' },
            });
            logger.debug(
              `Using cached member data for ${sid} (${Math.round(ageMinutes)}m old, ${existing.length} members)`
            );
            return existing;
          }
        }
      }

      // Crawl all pages of members
      const allMembers: RsiMemberData[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 100) {
        // Safety limit of 100 pages
        try {
          // Check if circuit breaker is open before continuing
          const circuitStatus = rsiCrawlerService.getCircuitStatus();
          if (circuitStatus.state === 'open') {
            logger.warn(
              `Circuit breaker is open, stopping member crawl for ${sid} at page ${page}`
            );
            break;
          }

          const members = await rsiCrawlerService.crawlOrganizationMembers(sid, page);

          if (members.length === 0) {
            hasMore = false;
          } else {
            allMembers.push(...members);
            page++;

            // Small delay between pages to be respectful
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error: unknown) {
          // If circuit breaker opens during crawl, stop gracefully
          if (
            error instanceof Error &&
            (error.message.includes('circuit breaker') || error.message.includes('Circuit breaker'))
          ) {
            logger.warn(
              `Circuit breaker opened while crawling members for ${sid} on page ${page}, stopping`
            );
            break;
          }

          // Re-throw other errors
          throw error;
        }
      }

      logger.info(
        `Crawled ${allMembers.length} members from ${page - 1} pages for organization ${sid}`
      );

      // Store in database using batch operations for better performance
      const storedMembers: RsiCrawledMember[] = [];

      // Fetch ALL existing members for this org so we can detect departures
      const existingMembers = await this.memberRepository.find({
        where: { organizationSid: sid.toUpperCase() },
      });

      const existingMap = new Map(existingMembers.map(m => [m.id, m]));
      const now = new Date();

      // Prepare members for batch save — with change detection
      const memberChanges: RsiChangeHistory[] = [];

      for (const memberData of allMembers) {
        const id = `${sid.toUpperCase()}:${memberData.handle}`;
        let member = existingMap.get(id);

        if (!member) {
          member = this.memberRepository.create({
            id,
            organizationSid: sid.toUpperCase(),
            handle: memberData.handle,
            roles: memberData.roles,
            firstCrawledAt: now,
          });
        } else {
          // Detect changes for existing members
          const memberFields: Array<[string, unknown, unknown]> = [
            ['rank', member.rank, memberData.rank],
            ['stars', member.stars, memberData.stars],
            ['displayName', member.displayName, memberData.displayName],
            ['isMain', member.isMain, memberData.isMain],
            ['isAffiliate', member.isAffiliate, memberData.isAffiliate],
            ['isHidden', member.isHidden, memberData.isHidden],
          ];
          for (const [field, oldVal, newVal] of memberFields) {
            this.detectFieldChange(memberChanges, 'member', id, field, oldVal, newVal);
          }
        }

        // Update fields
        member.displayName = memberData.displayName;
        member.rank = memberData.rank;
        member.stars = memberData.stars;
        member.isMain = memberData.isMain;
        member.isAffiliate = memberData.isAffiliate;
        member.isHidden = memberData.isHidden;
        member.avatar = memberData.avatar;
        member.enlisted = memberData.enlisted;
        member.roles = memberData.roles;
        member.crawlFailed = false;
        member.crawlError = undefined;
        member.lastCrawledAt = now;

        storedMembers.push(member);
      }

      // Detect members that disappeared (left org) and remove them.
      // Members that are hidden (isHidden=true) in crawled data are NOT treated as departed.
      // Members missing from crawl AND not previously hidden get a departure change recorded.
      // Safety: skip departure detection if crawl returned suspiciously few members
      // (e.g., RSI site glitch or circuit breaker tripped mid-crawl).
      const crawledHandles = new Set(allMembers.map(m => `${sid.toUpperCase()}:${m.handle}`));
      const departedMembers: RsiCrawledMember[] = [];
      const nonHiddenExisting = existingMembers.filter(m => !m.isHidden);
      const departureSafe =
        allMembers.length > 0 &&
        (nonHiddenExisting.length === 0 || allMembers.length / nonHiddenExisting.length > 0.5);

      if (departureSafe) {
        for (const existing of existingMembers) {
          if (!crawledHandles.has(existing.id) && !existing.isHidden) {
            this.detectFieldChange(
              memberChanges,
              'member',
              existing.id,
              'membership',
              'active',
              'removed'
            );
            departedMembers.push(existing);
          }
        }
      } else if (allMembers.length === 0) {
        logger.warn(
          `Crawl returned 0 members for org ${sid} — skipping departure detection to avoid mass deletion`
        );
      } else {
        logger.warn(
          `Crawl returned ${allMembers.length} members but ${nonHiddenExisting.length} exist — ` +
            `skipping departure detection (>50% drop, possible crawl failure)`
        );
      }

      if (departedMembers.length > 0) {
        logger.info(
          `Detected ${departedMembers.length} departed members for org ${sid}: ${departedMembers.map(m => m.handle).join(', ')}`
        );
      }

      // Save all members + changes in a single transaction
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const memberRows = storedMembers.map(member => this.toMemberUpsertRow(member));
        for (const batch of this.chunkItems(memberRows, this.memberBatchSize)) {
          await queryRunner.manager.upsert(RsiCrawledMember, batch, {
            conflictPaths: ['id'],
          });
        }

        if (departedMembers.length > 0) {
          const departedIds = departedMembers.map(member => member.id);
          for (const batch of this.chunkItems(departedIds, this.memberBatchSize)) {
            await queryRunner.manager.delete(RsiCrawledMember, batch);
          }
        }

        if (memberChanges.length > 0) {
          const changeRows = memberChanges.map(change => this.toChangeInsertRow(change));
          for (const batch of this.chunkItems(changeRows, this.memberBatchSize)) {
            await queryRunner.manager.insert(RsiChangeHistory, batch);
          }
        }

        await queryRunner.commitTransaction();
      } catch (txError: unknown) {
        await queryRunner.rollbackTransaction();
        const msg = txError instanceof Error ? txError.message : String(txError);
        logger.error(`Transaction failed for member batch save (org ${sid}): ${msg}`);
        throw txError;
      } finally {
        await queryRunner.release();
      }

      const departedInfo =
        departedMembers.length > 0 ? `, removed ${departedMembers.length} departed` : '';
      logger.info(`Stored ${storedMembers.length} members for organization ${sid}${departedInfo}`);
      return storedMembers;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.isDegradedCrawlerFailure(errorMessage)) {
        logger.warn(
          `Failed to fetch and store members for ${sid} (degraded control path): ${errorMessage}`
        );
      } else {
        logger.error(`Failed to fetch and store members for ${sid}: ${errorMessage}`);
      }

      // Try to get existing data
      const existing = await this.memberRepository.find({
        where: { organizationSid: sid.toUpperCase() },
        order: { handle: 'ASC' },
      });

      if (existing.length > 0) {
        logger.warn(
          `Using stale member data for ${sid} due to crawl failure (${existing.length} members)`
        );
        return existing;
      }

      throw new Error(`Failed to fetch member data: ${errorMessage}`);
    }
  }

  /**
   * Get organization data from database
   * @param sid - Organization SID
   * @returns Promise resolving to organization data or null
   */
  public async getOrganization(sid: string): Promise<RsiCrawledOrganization | null> {
    return this.orgRepository.findOne({
      where: { sid: sid.toUpperCase() },
    });
  }

  /**
   * Get members for an organization from database
   * @param sid - Organization SID
   * @param limit - Maximum number of members to return
   * @param offset - Number of members to skip
   * @returns Promise resolving to array of members and total count
   */
  public async getMembers(
    sid: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ members: RsiCrawledMember[]; total: number }> {
    const [members, total] = await this.memberRepository.findAndCount({
      where: { organizationSid: sid.toUpperCase() },
      order: { handle: 'ASC' },
      take: limit,
      skip: offset,
    });

    return { members, total };
  }

  /**
   * Get user's organization memberships from database
   * @param handle - User handle
   * @returns Promise resolving to array of memberships
   */
  public async getUserMemberships(handle: string): Promise<RsiCrawledMember[]> {
    return this.memberRepository.find({
      where: { handle: handle.toLowerCase() },
      order: { organizationSid: 'ASC' },
    });
  }

  /**
   * List all organizations in database
   * @param limit - Maximum number of organizations to return
   * @param offset - Number of organizations to skip
   * @returns Promise resolving to array of organizations and total count
   */
  public async listOrganizations(
    limit: number = 100,
    offset: number = 0
  ): Promise<{ organizations: RsiCrawledOrganization[]; total: number }> {
    const [organizations, total] = await this.orgRepository.findAndCount({
      order: { name: 'ASC' },
      take: limit,
      skip: offset,
    });

    return { organizations, total };
  }

  /**
   * Delete organization data
   * @param sid - Organization SID
   */
  public async deleteOrganization(sid: string): Promise<void> {
    // Delete members first (foreign key constraint)
    await this.memberRepository.delete({ organizationSid: sid.toUpperCase() });
    await this.orgRepository.delete({ sid: sid.toUpperCase() });

    logger.info(`Deleted organization data for ${sid}`);
  }

  /**
   * Get statistics about crawled data
   */
  public async getStatistics(): Promise<{
    totalOrgs: number;
    totalMembers: number;
    recentlyCrawledOrgs: number;
    failedOrgs: number;
  }> {
    const totalOrgs = await this.orgRepository.count();
    const totalMembers = await this.memberRepository.count();

    // Organizations crawled in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentlyCrawledOrgs = await this.orgRepository.count({
      where: {
        lastCrawledAt: MoreThanOrEqual(oneDayAgo),
      },
    });

    const failedOrgs = await this.orgRepository.count({
      where: { crawlFailed: true },
    });

    return {
      totalOrgs,
      totalMembers,
      recentlyCrawledOrgs,
      failedOrgs,
    };
  }

  /**
   * Get member count change history for an organization
   * Returns data points for graphing member count changes over time.
   * @param sid - Organization SID
   * @returns Array of { date, memberCount } data points
   */
  public async getMemberCountHistory(
    sid: string
  ): Promise<{ date: string; memberCount: number }[]> {
    const changes = await this.changeRepository.find({
      where: {
        entityType: 'organization' as RsiChangeEntityType,
        entityId: sid.toUpperCase(),
        fieldName: 'memberCount',
      },
      order: { detectedAt: 'ASC' },
    });

    if (changes.length === 0) {
      // Return current count as single point if no history
      const org = await this.orgRepository.findOne({
        where: { sid: sid.toUpperCase() },
        select: ['memberCount', 'lastCrawledAt'],
      });
      if (org) {
        return [{ date: org.lastCrawledAt.toISOString(), memberCount: org.memberCount }];
      }
      return [];
    }

    const dataPoints: { date: string; memberCount: number }[] = [];

    // Add the initial point (the old value of the first change)
    if (changes[0].oldValue !== null && changes[0].oldValue !== undefined) {
      dataPoints.push({
        date: changes[0].detectedAt.toISOString(),
        memberCount: Number(changes[0].oldValue),
      });
    }

    // Add each change point
    for (const change of changes) {
      if (change.newValue !== null && change.newValue !== undefined) {
        dataPoints.push({
          date: change.detectedAt.toISOString(),
          memberCount: Number(change.newValue),
        });
      }
    }

    return dataPoints;
  }
}

// Export singleton instance
export const rsiCrawlerDataService = new RsiCrawlerDataService();
