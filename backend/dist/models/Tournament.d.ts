export declare enum TournamentStatus {
    REGISTRATION = "registration",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled"
}
export declare enum MatchStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed"
}
export interface TournamentParticipant {
    userId: string;
    teamName?: string;
    registeredAt: Date;
    seed?: number;
}
export interface Match {
    matchId: string;
    round: number;
    participant1Id?: string;
    participant2Id?: string;
    winnerId?: string;
    score?: string;
    status: MatchStatus;
    scheduledDate?: Date;
    completedAt?: Date;
}
export declare class Tournament {
    id: string;
    name: string;
    description: string;
    organizerId: string;
    startDate: Date;
    endDate?: Date;
    status: TournamentStatus;
    maxParticipants: number;
    participants: TournamentParticipant[];
    matches: Match[];
    prizePool?: string;
    rules?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Tournament.d.ts.map