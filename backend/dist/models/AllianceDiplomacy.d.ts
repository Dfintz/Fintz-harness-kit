export declare enum DiplomacyStatus {
    PROPOSED = "proposed",
    ACTIVE = "active",
    SUSPENDED = "suspended",
    TERMINATED = "terminated"
}
export declare enum AllianceType {
    TRADE = "trade",
    MILITARY = "military",
    MUTUAL_DEFENSE = "mutual_defense",
    NON_AGGRESSION = "non_aggression",
    FULL_ALLIANCE = "full_alliance"
}
export interface DiplomaticTerm {
    term: string;
    description: string;
}
export interface DiplomaticIncident {
    incidentId: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reportedBy: string;
    timestamp: Date;
    resolved: boolean;
}
export declare class AllianceDiplomacy {
    id: string;
    orgId1: string;
    orgId2: string;
    allianceType: AllianceType;
    status: DiplomacyStatus;
    proposedBy: string;
    approvedBy?: string;
    terms: DiplomaticTerm[];
    incidents: DiplomaticIncident[];
    startDate?: Date;
    endDate?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=AllianceDiplomacy.d.ts.map