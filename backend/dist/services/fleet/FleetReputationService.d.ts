import { Repository } from 'typeorm';
import { Fleet } from '../../models/Fleet';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { TradeUserReputation } from '../../models/TradeUserReputation';
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
    overallScore: number;
    tier: string;
    memberCount: number;
    membersWithReputation: number;
    members: FleetMemberReputation[];
}
export declare class FleetReputationService {
    private static instance;
    private readonly fleetRepository;
    private readonly lfgReputationRepository;
    private readonly tradeReputationRepository;
    constructor(fleetRepo?: Repository<Fleet>, lfgRepo?: Repository<LFGUserReputation>, tradeRepo?: Repository<TradeUserReputation>);
    static getInstance(): FleetReputationService;
    getFleetReputation(organizationId: string, fleetId: string): Promise<FleetReputationScore>;
    private tierFromScore;
}
//# sourceMappingURL=FleetReputationService.d.ts.map