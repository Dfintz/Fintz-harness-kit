import { TenantEntity } from './base/TenantEntity';
import { Poll } from './Poll';
export declare class PollVote extends TenantEntity {
    id: string;
    pollId: string;
    userId: string;
    optionId: string;
    rank?: number;
    poll?: Poll;
    createdAt: Date;
}
//# sourceMappingURL=PollVote.d.ts.map