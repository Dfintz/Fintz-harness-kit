import { EventEmbedData } from '../embeds/eventEmbed';
type EmbedParticipantInput = {
    userId: string;
    userName?: string | null;
    status: string;
    role?: string | null;
    shipType?: string | null;
    shipName?: string | null;
    crewPosition?: string | null;
    crewShipId?: string | null;
    discordUserId?: string | null;
};
export declare function buildEmbedDataFromActivity(activity: {
    id: string;
    title: string;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    description?: string | null;
    location?: string | null;
    scheduledStartDate?: Date | null;
    creatorId?: string | null;
    creatorName?: string | null;
    activityType?: string;
    status?: string;
    requiredShipTypes?: string | null;
    bannerImageUrl?: string | null;
    participants?: Array<{
        userId: string;
        userName?: string;
        status: string;
        role?: string;
        shipType?: string;
        shipName?: string;
        crewPosition?: string;
        crewShipId?: string;
    }>;
    ships?: Array<{
        id?: string;
        shipType: string;
        shipName?: string;
        ownerId: string;
        ownerName: string;
        captainId?: string;
        captainName?: string;
        role?: string;
        crewCapacity: number;
        crewAssigned: number;
        crewMembers?: Array<{
            userId: string;
            userName: string;
            position: string;
        }>;
        crew?: Array<{
            userId: string;
            userName: string;
            position: string;
        }>;
        status?: string;
        loanerShip?: string;
        cargo?: number;
        vehicleCargo?: number;
        hangarSize?: string;
        fleetId?: string;
        fleetName?: string;
        parentShipId?: string;
        isTransported?: boolean;
        transportType?: string;
    }>;
    shipAssignments?: Array<{
        id?: string;
        shipId?: string;
        shipType: string;
        shipName?: string;
        ownerId: string;
        ownerName: string;
        captainId?: string;
        captainName?: string;
        role?: string;
        crewCapacity: number;
        crewAssigned: number;
        crewMembers?: Array<{
            userId: string;
            userName: string;
            position: string;
        }>;
        crew?: Array<{
            userId: string;
            userName: string;
            position: string;
        }>;
        status?: string;
        metadata?: {
            loanerShip?: string;
            cargoCapacity?: number;
            [key: string]: unknown;
        };
        fleetId?: string;
        fleetName?: string;
        parentShipId?: string;
        isTransported?: boolean;
        transportType?: string;
    }>;
    roleRequirements?: unknown;
    maxParticipants?: number | null;
    voiceChannelId?: string | null;
}, participantsOverride?: EmbedParticipantInput[], discordIdMap?: Map<string, string>): EventEmbedData;
export declare function resolveDiscordIdMap(userIds: string[]): Promise<Map<string, string>>;
export declare function collectUserIdsForEmbed(activity: {
    ships?: unknown;
    shipAssignments?: unknown;
}, participants: ReadonlyArray<{
    userId: string;
}>): string[];
export {};
//# sourceMappingURL=eventButtons.embedData.d.ts.map