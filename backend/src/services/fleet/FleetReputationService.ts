/**
 * FleetReputationService — F-2 (Unified Fleet Reputation Score)
 *
 * Aggregates individual member reputations (LFG + Trade) into a single
 * fleet-level score.  Optionally weights the fleet leader higher to
 * reflect their outsized influence on fleet outcomes.
 *
 * Scoring:
 *   memberScore = (lfgOverallScore * 0.5) + (tradeOverallScore * 0.5)
 *   leaderWeight = 1.5× (leader's score counts 1.5 of a normal member)
 *   fleetScore  = weightedAvg(memberScores)
 */

import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Fleet } from '../../models/Fleet';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { TradeUserReputation } from '../../models/TradeUserReputation';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface FleetMemberReputation {
  userId: string;
  isLeader: boolean;
  lfgScore: number;
  tradeScore: number;
  compositeScore: number;
}

export interface FleetReputationScore {
  fleetId: string;
  fleetName: string;
  organizationId: string;
  overallScore: number; // 0-100
  tier: string;
  memberCount: number;
  membersWithReputation: number;
  members: FleetMemberReputation[];
}

// ────────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────────

const CACHE_TTL = 300; // 5 minutes
const LEADER_WEIGHT = 1.5;

export class FleetReputationService {
  private static instance: FleetReputationService;

  private readonly fleetRepository: Repository<Fleet>;
  private readonly lfgReputationRepository: Repository<LFGUserReputation>;
  private readonly tradeReputationRepository: Repository<TradeUserReputation>;

  constructor(
    fleetRepo?: Repository<Fleet>,
    lfgRepo?: Repository<LFGUserReputation>,
    tradeRepo?: Repository<TradeUserReputation>
  ) {
    this.fleetRepository = fleetRepo ?? AppDataSource.getRepository(Fleet);
    this.lfgReputationRepository = lfgRepo ?? AppDataSource.getRepository(LFGUserReputation);
    this.tradeReputationRepository = tradeRepo ?? AppDataSource.getRepository(TradeUserReputation);
  }

  static getInstance(): FleetReputationService {
    if (!this.instance) {
      this.instance = new FleetReputationService();
    }
    return this.instance;
  }

  /**
   * Compute the aggregated reputation score for a fleet.
   *
   * @param organizationId  tenant scope
   * @param fleetId         fleet to evaluate
   */
  async getFleetReputation(organizationId: string, fleetId: string): Promise<FleetReputationScore> {
    const cacheKey = `fleet-reputation:${fleetId}`;
    const cached = await cache.get<FleetReputationScore>(cacheKey);
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
      const empty: FleetReputationScore = {
        fleetId: fleet.id,
        fleetName: fleet.name,
        organizationId,
        overallScore: 0,
        tier: this.tierFromScore(0),
        memberCount: 0,
        membersWithReputation: 0,
        members: [],
      };
      await cache.set(cacheKey, empty, CACHE_TTL);
      return empty;
    }

    // Batch-fetch reputation data for all members
    const [lfgRows, tradeRows] = await Promise.all([
      this.lfgReputationRepository.find({ where: { userId: In(memberIds) } }),
      this.tradeReputationRepository.find({ where: { userId: In(memberIds) } }),
    ]);

    const lfgMap = new Map(lfgRows.map(r => [r.userId, Number(r.overallScore)]));
    const tradeMap = new Map(tradeRows.map(r => [r.userId, Number(r.overallScore)]));

    // Build per-member breakdown
    const members: FleetMemberReputation[] = memberIds.map(uid => {
      const lfgScore = lfgMap.get(uid) ?? 50; // neutral default
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

    // Weighted average (leader gets LEADER_WEIGHT multiplier)
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

    const result: FleetReputationScore = {
      fleetId: fleet.id,
      fleetName: fleet.name,
      organizationId,
      overallScore,
      tier: this.tierFromScore(overallScore),
      memberCount: memberIds.length,
      membersWithReputation: membersWithRep,
      members,
    };

    await cache.set(cacheKey, result, CACHE_TTL);
    logger.debug('FleetReputationService.getFleetReputation computed', {
      fleetId,
      overallScore,
      memberCount: memberIds.length,
    });

    return result;
  }

  // ────────────────────── Helpers ──────────────────────

  private tierFromScore(score: number): string {
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

