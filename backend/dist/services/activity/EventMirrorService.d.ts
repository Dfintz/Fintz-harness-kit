import { Activity } from '../../models/Activity';
import { MirroredActivity } from '../../models/MirroredActivity';
import { TenantService } from '../base/TenantService';
export declare const MIRROR_SYNC_CHANNEL = "mirror:rsvp:sync";
export interface CreateMirrorDTO {
    sourceActivityId: string;
    sourceGuildId: string;
    sourceOrganizationId: string;
    mirrorGuildId: string;
    mirrorChannelId: string;
    mirrorKey?: string;
    targetOrganizationId: string;
}
export interface MirrorResult {
    success: boolean;
    mirror?: MirroredActivity;
    message: string;
}
export declare class EventMirrorService extends TenantService<MirroredActivity> {
    private readonly activityRepository;
    private static instance;
    constructor();
    static getInstance(): EventMirrorService;
    createMirror(dto: CreateMirrorDTO): Promise<MirrorResult>;
    resolveMaxMirrors(guildId: string, organizationId: string): Promise<number>;
    getMirrorsForEvent(sourceActivityId: string): Promise<MirroredActivity[]>;
    getMirrorsForGuild(guildId: string): Promise<MirroredActivity[]>;
    findMirror(sourceActivityId: string, mirrorGuildId: string): Promise<MirroredActivity | null>;
    findRelatedMirrors(activityId: string): Promise<MirroredActivity[]>;
    setMirrorMessageId(mirrorId: string, messageId: string): Promise<void>;
    setMirrorActivityId(mirrorId: string, mirrorActivityId: string): Promise<void>;
    recordSync(mirrorId: string): Promise<void>;
    cancelMirror(mirrorId: string): Promise<MirrorResult>;
    expireMirrorsForEvent(sourceActivityId: string): Promise<number>;
    setEventMirrorKey(activityId: string, rawKey: string): Promise<{
        success: boolean;
        message: string;
    }>;
    validateMirrorKey(activityId: string, rawKey: string): Promise<boolean>;
    generateInviteCode(activityId: string, mirrorKey?: string): Promise<{
        success: boolean;
        inviteCode?: string;
        message: string;
    }>;
    findActivityByInviteCode(inviteCode: string): Promise<Activity | null>;
    static createInviteCode(): string;
    static hashMirrorKey(rawKey: string): string;
    static resetInstance(): void;
}
//# sourceMappingURL=EventMirrorService.d.ts.map