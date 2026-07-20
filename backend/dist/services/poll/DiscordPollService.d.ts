import { Poll } from '../../models/Poll';
import { PollDiscordMirror, PollMirrorScope } from '../../models/PollDiscordMirror';
import type { PollResults } from './PollService';
export interface MirrorToGuildDTO {
    guildId: string;
    channelId: string;
}
export interface MirrorToFederationDTO {
    federationId: string;
    channelId?: string;
}
export declare class DiscordPollService {
    private readonly mirrorRepository;
    private readonly federationMemberRepository;
    private readonly guildOrgService;
    constructor();
    mirrorPollToGuild(poll: Poll, organizationId: string, dto: MirrorToGuildDTO, scope?: PollMirrorScope, federationId?: string): Promise<PollDiscordMirror>;
    mirrorPollToFederation(poll: Poll, organizationId: string, dto: MirrorToFederationDTO): Promise<PollDiscordMirror[]>;
    updateAllMirrors(poll: Poll, results: PollResults | null): Promise<void>;
    closeAllMirrors(poll: Poll, results: PollResults | null): Promise<void>;
    getMirrorsForPoll(pollId: string, organizationId: string): Promise<PollDiscordMirror[]>;
    deleteMirror(mirrorId: string, organizationId: string): Promise<void>;
    private deliverMirror;
    private updateMirrorEmbed;
    private getClient;
}
//# sourceMappingURL=DiscordPollService.d.ts.map