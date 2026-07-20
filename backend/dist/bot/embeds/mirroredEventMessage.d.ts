import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { Activity } from '../../models/Activity';
export declare function buildMirroredEventEmbed(activity: Activity, mirrorId?: string): Promise<EmbedBuilder>;
export declare function buildMirroredEventComponents(activityId: string): [ActionRowBuilder<ButtonBuilder>, ActionRowBuilder<ButtonBuilder>];
export declare function buildSourceEventMessage(activity: Activity): Promise<{
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
}>;
//# sourceMappingURL=mirroredEventMessage.d.ts.map