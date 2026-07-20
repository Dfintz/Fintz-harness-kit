import { Briefing } from '../../models/Briefing';
interface DiscordEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}
interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: DiscordEmbedField[];
    footer: {
        text: string;
    };
    timestamp?: string;
}
export interface PostBriefingContext {
    readonly organizationId: string;
    readonly userId: string;
}
export declare function buildBriefingDiscordEmbed(briefing: Briefing): DiscordEmbed;
export declare class BriefingDiscordWebhookService {
    postBriefingToWebhook(briefing: Briefing, webhookUrl: string, ctx: PostBriefingContext): Promise<void>;
}
export {};
//# sourceMappingURL=BriefingDiscordWebhookService.d.ts.map