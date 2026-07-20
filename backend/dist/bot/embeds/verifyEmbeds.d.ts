import { EmbedBuilder } from 'discord.js';
export declare function buildVerificationCompleteEmbed(rsiHandle: string): EmbedBuilder;
export declare function buildVerificationPendingEmbed(error?: string): EmbedBuilder;
export declare function buildNoRsiLinkEmbed(): EmbedBuilder;
export interface RsiLinkStatusInput {
    rsiHandle: string;
    verifiedAt?: string | null;
    syncStatus?: string | null;
    lastKnownRank?: string | null;
    isAffiliate?: boolean | null;
    lastSyncedAt?: string | null;
    verificationUrl?: string | null;
    verificationCode?: string | null;
}
export declare function buildRsiLinkStatusEmbed(link: RsiLinkStatusInput): EmbedBuilder;
export declare function buildRsiLinkStatusNotLinkedEmbed(): EmbedBuilder;
export declare function buildRsiUnlinkedEmbed(): EmbedBuilder;
export declare function buildDiscordAccountNotLinkedEmbed(message: string): EmbedBuilder;
export declare function buildRsiLinkInitiatedEmbed(handle: string, profileUrl: string, verificationLink?: string, verificationCode?: string): EmbedBuilder;
//# sourceMappingURL=verifyEmbeds.d.ts.map