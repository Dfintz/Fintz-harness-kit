import { Poll, PollOption, PollStatus, PollType, PollVisibility } from '../../models/Poll';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export declare enum PollAuditAction {
    POLL_CREATED = "poll_created",
    POLL_UPDATED = "poll_updated",
    POLL_CLOSED = "poll_closed",
    POLL_CANCELLED = "poll_cancelled",
    POLL_DELETED = "poll_deleted",
    VOTE_CAST = "vote_cast"
}
export interface CreatePollDTO {
    title: string;
    description?: string;
    pollType: PollType;
    visibility?: PollVisibility;
    options: PollOption[];
    isAnonymous?: boolean;
    maxSelections?: number;
    endsAt?: Date;
    allowedRoles?: string[];
    status?: PollStatus;
}
export interface UpdatePollDTO {
    title?: string;
    description?: string;
    visibility?: PollVisibility;
    options?: PollOption[];
    isAnonymous?: boolean;
    maxSelections?: number;
    endsAt?: Date;
    allowedRoles?: string[];
}
export interface CastVoteDTO {
    optionId: string;
    rank?: number;
}
export interface PollSearchFilters {
    status?: PollStatus;
    pollType?: PollType;
    createdBy?: string;
    searchTerm?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export interface PollResults {
    pollId: string;
    totalVotes: number;
    optionCounts: Record<string, number>;
    options: Array<PollOption & {
        optionId: string;
        voteCount: number;
        percentage: number;
    }>;
    hasVoted: boolean;
    userVotes?: string[];
}
export declare class PollService extends TenantService<Poll> {
    private readonly voteRepository;
    private readonly discordPollService;
    constructor();
    private logPollAudit;
    private autoCloseIfExpired;
    createPoll(organizationId: string, creatorId: string, creatorName: string, dto: CreatePollDTO): Promise<Poll>;
    getPollById(organizationId: string, pollId: string): Promise<Poll | null>;
    listPolls(organizationId: string, filters: PollSearchFilters, pagination: PaginationOptions): Promise<PaginatedResponse<Poll>>;
    updatePoll(organizationId: string, pollId: string, userId: string, userName: string, dto: UpdatePollDTO): Promise<Poll | null>;
    deletePoll(organizationId: string, pollId: string, userId: string, userName: string): Promise<void>;
    castVote(organizationId: string, pollId: string, userId: string, votes: CastVoteDTO[]): Promise<void>;
    toggleVote(organizationId: string, pollId: string, userId: string, optionId: string): Promise<{
        selected: boolean;
        selectedOptionIds: string[];
    }>;
    getResults(organizationId: string, pollId: string, currentUserId: string): Promise<PollResults | null>;
    closePoll(organizationId: string, pollId: string, userId: string, userName: string): Promise<Poll | null>;
    closeExpiredPolls(): Promise<number>;
}
//# sourceMappingURL=PollService.d.ts.map