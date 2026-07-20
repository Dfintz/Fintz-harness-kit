export declare class LFGGroupHistory {
    id: string;
    lfgPostId: string;
    activity: string;
    description: string;
    creatorId: string;
    creatorName: string;
    participantIds: string[];
    participantCount: number;
    guildId: string;
    channelId: string;
    wasSuccessful: boolean;
    durationMinutes?: number;
    completionNotes?: {
        submittedBy: string;
        note: string;
        timestamp: Date;
    };
    completedAt: Date;
    userId: string;
    getSuccessScore(): number;
    getSummary(): {
        activity: string;
        participants: number;
        successful: boolean;
        duration?: number;
    };
}
//# sourceMappingURL=LFGGroupHistory.d.ts.map