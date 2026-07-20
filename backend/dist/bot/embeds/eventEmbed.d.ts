import type { ActivityCardData, PassengerSlot, TransportType } from '@sc-fleet-manager/shared-types';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { type ShipRequirement } from '../constants/shipTaxonomy';
export declare const RSVP_LEGEND = "\u2705 Join \u00B7 \u2753 Tentative \u00B7 \u274C Decline \u00B7 \uD83D\uDCE4 Withdraw";
export interface EmbedCrewMember {
    userId: string;
    userName: string;
    position: string;
    discordUserId?: string;
}
export type EmbedPassengerSlot = PassengerSlot;
export interface EmbedShipAssignment {
    id: string;
    shipType: string;
    shipName?: string;
    ownerId: string;
    ownerName: string;
    fleetId?: string;
    fleetName?: string;
    captainId?: string;
    captainName?: string;
    role?: string;
    crewCapacity: number;
    crewAssigned: number;
    crewMembers: EmbedCrewMember[];
    status?: string;
    loanerShip?: string;
    isLoaner?: boolean;
    contributedBy?: string;
    cargo?: number;
    vehicleCargo?: number;
    hangarSize?: string;
    parentShipId?: string;
    isTransported?: boolean;
    transportType?: TransportType;
    passengers?: EmbedPassengerSlot[];
}
export interface EventEmbedData extends ActivityCardData {
    updatedAt?: string | Date;
    focusRole?: string;
    creatorId?: string;
    bannerImageUrl?: string;
    voiceChannelId?: string;
    shipRequirements?: string[];
    shipRequestsByRole?: ShipRequirement[];
    ships?: EmbedShipAssignment[];
    participants?: Array<{
        userId: string;
        userName?: string;
        discordUserId?: string;
        status: string;
        role?: string;
        shipType?: string;
        shipName?: string;
        crewPosition?: string;
        crewShipId?: string;
    }>;
    roleRequirements?: Array<{
        role: string;
        count?: number;
        min?: number;
        required?: boolean;
    }>;
    metadata?: Record<string, unknown>;
    totalCargoCapacity?: number;
    totalQuantumFuel?: number;
    totalQuantumFuelRequired?: number;
    maxJumpRange?: number;
    hasRefuelShip?: boolean;
    hasRepairShip?: boolean;
    hasRearmShip?: boolean;
    hasMedicalShip?: boolean;
}
export declare function buildEventEmbed(event: EventEmbedData): EmbedBuilder;
export declare function buildEventButtons(activityId: string): ActionRowBuilder<ButtonBuilder>;
export declare function parseEventButtonId(customId: string): {
    action: 'join' | 'tentative' | 'decline' | 'leave' | 'actions' | 'bringship' | 'removeship' | 'joincrew' | 'leavecrew' | 'requestship' | 'joinpassenger' | 'leavepassenger' | 'manageslots' | 'bringfleet' | 'remindme' | 'edit' | 'clone' | 'cancel' | 'confirmcancel' | 'canceldismiss';
    activityId: string;
} | null;
export declare function buildEventActionsRow(activityId: string): ActionRowBuilder<ButtonBuilder>;
export declare function buildEventActionPanelComponents(activityId: string): ActionRowBuilder<ButtonBuilder>[];
export declare function buildCancelButton(activityId: string): ActionRowBuilder<ButtonBuilder>;
export declare function buildEventComponentRows(activityId: string, options?: {
    includeManage?: boolean;
}): ActionRowBuilder<ButtonBuilder>[];
//# sourceMappingURL=eventEmbed.d.ts.map