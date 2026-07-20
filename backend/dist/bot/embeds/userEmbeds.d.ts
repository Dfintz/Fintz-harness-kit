import { EmbedBuilder } from 'discord.js';
interface UserPublicHangarSnapshotEmbedInput {
    displayName: string;
    totalShips: number;
    needsInsurance: number;
    totalValue: number;
    publicCount: number;
    orgCount: number;
    allianceCount: number;
    statusBreakdown: string;
    roleBreakdown: string;
    topShips: string;
    hangarUrl: string;
}
export declare function buildUserRootHubEmbed(): EmbedBuilder;
export declare function buildUserPublicHangarSnapshotEmbed(input: Readonly<UserPublicHangarSnapshotEmbedInput>): EmbedBuilder;
export {};
//# sourceMappingURL=userEmbeds.d.ts.map