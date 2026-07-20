"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetReputationService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const LFGUserReputation_1 = require("../../models/LFGUserReputation");
const TradeUserReputation_1 = require("../../models/TradeUserReputation");
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const CACHE_TTL = 300;
const LEADER_WEIGHT = 1.5;
class FleetReputationService {
    static instance;
    fleetRepository;
    lfgReputationRepository;
    tradeReputationRepository;
    constructor(fleetRepo, lfgRepo, tradeRepo) {
        this.fleetRepository = fleetRepo ?? data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        this.lfgReputationRepository = lfgRepo ?? data_source_1.AppDataSource.getRepository(LFGUserReputation_1.LFGUserReputation);
        this.tradeReputationRepository = tradeRepo ?? data_source_1.AppDataSource.getRepository(TradeUserReputation_1.TradeUserReputation);
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new FleetReputationService();
        }
        return this.instance;
    }
    async getFleetReputation(organizationId, fleetId) {
        const cacheKey = `fleet-reputation:${fleetId}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const fleet = await this.fleetRepository.findOne({
            where: { id: fleetId, organizationId },
        });
        if (!fleet) {
            throw new Error('Fleet not found');
        }
        const memberIds = fleet.members ?? [];
        if (memberIds.length === 0) {
            const empty = {
                fleetId: fleet.id,
                fleetName: fleet.name,
                organizationId,
                overallScore: 0,
                tier: this.tierFromScore(0),
                memberCount: 0,
                membersWithReputation: 0,
                members: [],
            };
            await redis_1.cache.set(cacheKey, empty, CACHE_TTL);
            return empty;
        }
        const [lfgRows, tradeRows] = await Promise.all([
            this.lfgReputationRepository.find({ where: { userId: (0, typeorm_1.In)(memberIds) } }),
            this.tradeReputationRepository.find({ where: { userId: (0, typeorm_1.In)(memberIds) } }),
        ]);
        const lfgMap = new Map(lfgRows.map(r => [r.userId, Number(r.overallScore)]));
        const tradeMap = new Map(tradeRows.map(r => [r.userId, Number(r.overallScore)]));
        const members = memberIds.map(uid => {
            const lfgScore = lfgMap.get(uid) ?? 50;
            const tradeScore = tradeMap.get(uid) ?? 50;
            const compositeScore = Math.round(lfgScore * 0.5 + tradeScore * 0.5);
            return {
                userId: uid,
                isLeader: uid === fleet.leaderId,
                lfgScore,
                tradeScore,
                compositeScore,
            };
        });
        let totalWeight = 0;
        let weightedSum = 0;
        let membersWithRep = 0;
        for (const m of members) {
            const hasRepData = lfgMap.has(m.userId) || tradeMap.has(m.userId);
            if (hasRepData) {
                membersWithRep++;
            }
            const weight = m.isLeader ? LEADER_WEIGHT : 1;
            totalWeight += weight;
            weightedSum += m.compositeScore * weight;
        }
        const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
        const result = {
            fleetId: fleet.id,
            fleetName: fleet.name,
            organizationId,
            overallScore,
            tier: this.tierFromScore(overallScore),
            memberCount: memberIds.length,
            membersWithReputation: membersWithRep,
            members,
        };
        await redis_1.cache.set(cacheKey, result, CACHE_TTL);
        logger_1.logger.debug('FleetReputationService.getFleetReputation computed', {
            fleetId,
            overallScore,
            memberCount: memberIds.length,
        });
        return result;
    }
    tierFromScore(score) {
        if (score >= 90) {
            return 'Legendary';
        }
        if (score >= 75) {
            return 'Excellent';
        }
        if (score >= 60) {
            return 'Good';
        }
        if (score >= 40) {
            return 'Average';
        }
        if (score >= 20) {
            return 'Below Average';
        }
        return 'Untested';
    }
}
exports.FleetReputationService = FleetReputationService;
//# sourceMappingURL=FleetReputationService.js.map