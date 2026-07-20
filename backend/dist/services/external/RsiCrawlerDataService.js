"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiCrawlerDataService = exports.RsiCrawlerDataService = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const RsiChangeHistory_1 = require("../../models/RsiChangeHistory");
const RsiCrawledMember_1 = require("../../models/RsiCrawledMember");
const RsiCrawledOrganization_1 = require("../../models/RsiCrawledOrganization");
const logger_1 = require("../../utils/logger");
const RsiCrawlerService_1 = require("./RsiCrawlerService");
class RsiCrawlerDataService {
    orgRepository = database_1.AppDataSource.getRepository(RsiCrawledOrganization_1.RsiCrawledOrganization);
    memberRepository = database_1.AppDataSource.getRepository(RsiCrawledMember_1.RsiCrawledMember);
    changeRepository = database_1.AppDataSource.getRepository(RsiChangeHistory_1.RsiChangeHistory);
    memberBatchSize = 250;
    isDegradedCrawlerFailure(message) {
        const lowered = message.toLowerCase();
        return (lowered.includes('circuit breaker') ||
            lowered.includes('rate limit') ||
            lowered.includes('status code 503') ||
            lowered.includes('service unavailable') ||
            lowered.includes('failed to crawl organization: 503') ||
            lowered.includes('failed to crawl members: 503'));
    }
    detectFieldChange(changes, entityType, entityId, fieldName, oldVal, newVal) {
        const toStr = (v) => {
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
        const change = new RsiChangeHistory_1.RsiChangeHistory();
        change.entityType = entityType;
        change.entityId = entityId;
        change.fieldName = fieldName;
        change.oldValue = oldStr;
        change.newValue = newStr;
        changes.push(change);
    }
    async saveChanges(changes) {
        if (changes.length === 0) {
            return;
        }
        try {
            await this.changeRepository.save(changes);
            logger_1.logger.info(`Recorded ${changes.length} RSI change(s)`);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger_1.logger.warn(`Failed to persist RSI change history: ${msg}`);
        }
    }
    chunkItems(items, size) {
        if (items.length === 0) {
            return [];
        }
        const chunks = [];
        for (let index = 0; index < items.length; index += size) {
            chunks.push(items.slice(index, index + size));
        }
        return chunks;
    }
    toMemberUpsertRow(member) {
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
    toChangeInsertRow(change) {
        return {
            entityType: change.entityType,
            entityId: change.entityId,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
        };
    }
    async fetchAndStoreOrganization(sid, force = false) {
        try {
            if (!force) {
                const existing = await this.orgRepository.findOne({
                    where: { sid: sid.toUpperCase() },
                });
                if (existing && !existing.crawlFailed) {
                    const ageMinutes = (Date.now() - existing.lastCrawledAt.getTime()) / 60000;
                    if (ageMinutes < 60) {
                        logger_1.logger.debug(`Using cached organization data for ${sid} (${Math.round(ageMinutes)}m old)`);
                        return existing;
                    }
                }
            }
            const crawledData = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(sid);
            let org = await this.orgRepository.findOne({
                where: { sid: crawledData.sid },
            });
            if (!org) {
                org = this.orgRepository.create({
                    sid: crawledData.sid,
                    firstCrawledAt: new Date(),
                });
            }
            const orgChanges = [];
            if (org.lastCrawledAt) {
                const orgFields = [
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
                    this.detectFieldChange(orgChanges, 'organization', crawledData.sid, field, oldVal, newVal);
                }
            }
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
            await this.saveChanges(orgChanges);
            logger_1.logger.info(`Stored organization data for ${sid}`);
            return org;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (this.isDegradedCrawlerFailure(errorMessage)) {
                logger_1.logger.warn(`Failed to fetch and store organization ${sid} (degraded control path): ${errorMessage}`);
            }
            else {
                logger_1.logger.error(`Failed to fetch and store organization ${sid}: ${errorMessage}`);
            }
            const existing = await this.orgRepository.findOne({
                where: { sid: sid.toUpperCase() },
            });
            if (existing) {
                existing.crawlFailed = true;
                existing.crawlError = errorMessage;
                existing.lastCrawledAt = new Date();
                await this.orgRepository.save(existing);
                logger_1.logger.warn(`Using stale organization data for ${sid} due to crawl failure`);
                return existing;
            }
            throw new Error(`Failed to fetch organization data: ${errorMessage}`);
        }
    }
    async fetchAndStoreMembers(sid, force = false) {
        try {
            if (!force) {
                const freshCheck = await this.memberRepository.findOne({
                    select: ['lastCrawledAt', 'crawlFailed'],
                    where: { organizationSid: sid.toUpperCase() },
                    order: { handle: 'ASC' },
                });
                if (freshCheck && !freshCheck.crawlFailed) {
                    const ageMinutes = (Date.now() - freshCheck.lastCrawledAt.getTime()) / 60000;
                    if (ageMinutes < 60) {
                        const existing = await this.memberRepository.find({
                            where: { organizationSid: sid.toUpperCase() },
                            order: { handle: 'ASC' },
                        });
                        logger_1.logger.debug(`Using cached member data for ${sid} (${Math.round(ageMinutes)}m old, ${existing.length} members)`);
                        return existing;
                    }
                }
            }
            const allMembers = [];
            let page = 1;
            let hasMore = true;
            while (hasMore && page <= 100) {
                try {
                    const circuitStatus = RsiCrawlerService_1.rsiCrawlerService.getCircuitStatus();
                    if (circuitStatus.state === 'open') {
                        logger_1.logger.warn(`Circuit breaker is open, stopping member crawl for ${sid} at page ${page}`);
                        break;
                    }
                    const members = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganizationMembers(sid, page);
                    if (members.length === 0) {
                        hasMore = false;
                    }
                    else {
                        allMembers.push(...members);
                        page++;
                        if (hasMore) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
                catch (error) {
                    if (error instanceof Error &&
                        (error.message.includes('circuit breaker') || error.message.includes('Circuit breaker'))) {
                        logger_1.logger.warn(`Circuit breaker opened while crawling members for ${sid} on page ${page}, stopping`);
                        break;
                    }
                    throw error;
                }
            }
            logger_1.logger.info(`Crawled ${allMembers.length} members from ${page - 1} pages for organization ${sid}`);
            const storedMembers = [];
            const existingMembers = await this.memberRepository.find({
                where: { organizationSid: sid.toUpperCase() },
            });
            const existingMap = new Map(existingMembers.map(m => [m.id, m]));
            const now = new Date();
            const memberChanges = [];
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
                }
                else {
                    const memberFields = [
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
            const crawledHandles = new Set(allMembers.map(m => `${sid.toUpperCase()}:${m.handle}`));
            const departedMembers = [];
            const nonHiddenExisting = existingMembers.filter(m => !m.isHidden);
            const departureSafe = allMembers.length > 0 &&
                (nonHiddenExisting.length === 0 || allMembers.length / nonHiddenExisting.length > 0.5);
            if (departureSafe) {
                for (const existing of existingMembers) {
                    if (!crawledHandles.has(existing.id) && !existing.isHidden) {
                        this.detectFieldChange(memberChanges, 'member', existing.id, 'membership', 'active', 'removed');
                        departedMembers.push(existing);
                    }
                }
            }
            else if (allMembers.length === 0) {
                logger_1.logger.warn(`Crawl returned 0 members for org ${sid} — skipping departure detection to avoid mass deletion`);
            }
            else {
                logger_1.logger.warn(`Crawl returned ${allMembers.length} members but ${nonHiddenExisting.length} exist — ` +
                    `skipping departure detection (>50% drop, possible crawl failure)`);
            }
            if (departedMembers.length > 0) {
                logger_1.logger.info(`Detected ${departedMembers.length} departed members for org ${sid}: ${departedMembers.map(m => m.handle).join(', ')}`);
            }
            const queryRunner = database_1.AppDataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                const memberRows = storedMembers.map(member => this.toMemberUpsertRow(member));
                for (const batch of this.chunkItems(memberRows, this.memberBatchSize)) {
                    await queryRunner.manager.upsert(RsiCrawledMember_1.RsiCrawledMember, batch, {
                        conflictPaths: ['id'],
                    });
                }
                if (departedMembers.length > 0) {
                    const departedIds = departedMembers.map(member => member.id);
                    for (const batch of this.chunkItems(departedIds, this.memberBatchSize)) {
                        await queryRunner.manager.delete(RsiCrawledMember_1.RsiCrawledMember, batch);
                    }
                }
                if (memberChanges.length > 0) {
                    const changeRows = memberChanges.map(change => this.toChangeInsertRow(change));
                    for (const batch of this.chunkItems(changeRows, this.memberBatchSize)) {
                        await queryRunner.manager.insert(RsiChangeHistory_1.RsiChangeHistory, batch);
                    }
                }
                await queryRunner.commitTransaction();
            }
            catch (txError) {
                await queryRunner.rollbackTransaction();
                const msg = txError instanceof Error ? txError.message : String(txError);
                logger_1.logger.error(`Transaction failed for member batch save (org ${sid}): ${msg}`);
                throw txError;
            }
            finally {
                await queryRunner.release();
            }
            const departedInfo = departedMembers.length > 0 ? `, removed ${departedMembers.length} departed` : '';
            logger_1.logger.info(`Stored ${storedMembers.length} members for organization ${sid}${departedInfo}`);
            return storedMembers;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (this.isDegradedCrawlerFailure(errorMessage)) {
                logger_1.logger.warn(`Failed to fetch and store members for ${sid} (degraded control path): ${errorMessage}`);
            }
            else {
                logger_1.logger.error(`Failed to fetch and store members for ${sid}: ${errorMessage}`);
            }
            const existing = await this.memberRepository.find({
                where: { organizationSid: sid.toUpperCase() },
                order: { handle: 'ASC' },
            });
            if (existing.length > 0) {
                logger_1.logger.warn(`Using stale member data for ${sid} due to crawl failure (${existing.length} members)`);
                return existing;
            }
            throw new Error(`Failed to fetch member data: ${errorMessage}`);
        }
    }
    async getOrganization(sid) {
        return this.orgRepository.findOne({
            where: { sid: sid.toUpperCase() },
        });
    }
    async getMembers(sid, limit = 100, offset = 0) {
        const [members, total] = await this.memberRepository.findAndCount({
            where: { organizationSid: sid.toUpperCase() },
            order: { handle: 'ASC' },
            take: limit,
            skip: offset,
        });
        return { members, total };
    }
    async getUserMemberships(handle) {
        return this.memberRepository.find({
            where: { handle: handle.toLowerCase() },
            order: { organizationSid: 'ASC' },
        });
    }
    async listOrganizations(limit = 100, offset = 0) {
        const [organizations, total] = await this.orgRepository.findAndCount({
            order: { name: 'ASC' },
            take: limit,
            skip: offset,
        });
        return { organizations, total };
    }
    async deleteOrganization(sid) {
        await this.memberRepository.delete({ organizationSid: sid.toUpperCase() });
        await this.orgRepository.delete({ sid: sid.toUpperCase() });
        logger_1.logger.info(`Deleted organization data for ${sid}`);
    }
    async getStatistics() {
        const totalOrgs = await this.orgRepository.count();
        const totalMembers = await this.memberRepository.count();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentlyCrawledOrgs = await this.orgRepository.count({
            where: {
                lastCrawledAt: (0, typeorm_1.MoreThanOrEqual)(oneDayAgo),
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
    async getMemberCountHistory(sid) {
        const changes = await this.changeRepository.find({
            where: {
                entityType: 'organization',
                entityId: sid.toUpperCase(),
                fieldName: 'memberCount',
            },
            order: { detectedAt: 'ASC' },
        });
        if (changes.length === 0) {
            const org = await this.orgRepository.findOne({
                where: { sid: sid.toUpperCase() },
                select: ['memberCount', 'lastCrawledAt'],
            });
            if (org) {
                return [{ date: org.lastCrawledAt.toISOString(), memberCount: org.memberCount }];
            }
            return [];
        }
        const dataPoints = [];
        if (changes[0].oldValue !== null && changes[0].oldValue !== undefined) {
            dataPoints.push({
                date: changes[0].detectedAt.toISOString(),
                memberCount: Number(changes[0].oldValue),
            });
        }
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
exports.RsiCrawlerDataService = RsiCrawlerDataService;
exports.rsiCrawlerDataService = new RsiCrawlerDataService();
//# sourceMappingURL=RsiCrawlerDataService.js.map