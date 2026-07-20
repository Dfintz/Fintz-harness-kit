import { PollOption } from '../../models/Poll';
export type FederationVotingMode = 'equal' | 'weighted';
export interface FederationPollData {
    id: string;
    federationId: string;
    title: string;
    description: string | null;
    pollType: string;
    options: PollOption[];
    votingMode: FederationVotingMode;
    isAnonymous: boolean;
    maxSelections: number;
    status: string;
    createdBy: string;
    createdByName: string | null;
    endsAt: Date | null;
    closedAt: Date | null;
    totalVotes: number;
    createdAt: Date;
}
export interface FederationPollResults {
    pollId: string;
    totalVotes: number;
    optionCounts: Record<string, number>;
    hasVoted: boolean;
}
export interface FederationPollDiscordPostResult {
    mirrorId: string;
    guildId: string;
    channelId: string;
    status: string;
    messageId: string | null;
}
export declare class FederationPollService {
    private static instance;
    private readonly pollRepository;
    private readonly voteRepository;
    private readonly memberRepository;
    private readonly federationRepository;
    private readonly discordPollService;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationPollService;
    private toData;
    private requirePermission;
    createPoll(federationId: string, userId: string, data: {
        title: string;
        description?: string;
        pollType?: string;
        options: Array<{
            label: string;
            description?: string;
        }>;
        votingMode?: FederationVotingMode;
        isAnonymous?: boolean;
        maxSelections?: number;
        endsAt?: string;
        createdByName?: string;
    }): Promise<FederationPollData>;
    listPolls(federationId: string, userId: string, status?: string): Promise<FederationPollData[]>;
    castVote(federationId: string, userId: string, pollId: string, optionId: string): Promise<FederationPollResults>;
    getResults(federationId: string, userId: string, pollId: string): Promise<FederationPollResults>;
    private computeResults;
    private computeWeightedVotes;
    closePoll(federationId: string, userId: string, pollId: string): Promise<FederationPollData>;
    deletePoll(federationId: string, userId: string, pollId: string): Promise<void>;
    postPollToDiscord(federationId: string, userId: string, pollId: string, channelId: string): Promise<FederationPollDiscordPostResult>;
}
//# sourceMappingURL=FederationPollService.d.ts.map