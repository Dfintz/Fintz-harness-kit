import { EmbedBuilder } from 'discord.js';
interface OrgPublicFleetSnapshotEmbedInput {
    organizationLabel: string;
    totalFleets: number;
    totalShips: number;
    activeFleetCount: number;
    publicFleetCount: number;
    statusBreakdown: string;
    roleBreakdown: string;
    topFleets: string;
    fleetUrl: string;
}
export declare function buildOrgRootHubEmbed(): EmbedBuilder;
export declare function buildOrgPublicFleetSnapshotEmbed(input: Readonly<OrgPublicFleetSnapshotEmbedInput>): EmbedBuilder;
export {};
//# sourceMappingURL=orgEmbeds.d.ts.map