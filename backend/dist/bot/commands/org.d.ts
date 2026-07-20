import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
import type { Fleet } from '../../models/Fleet';
import { BotCommand } from './types';
export declare function buildOrgFleetListPanel(fleets: Fleet[], shipCounts: Map<string, number>, page: number): {
    description: string;
    navRow: ActionRowBuilder<ButtonBuilder> | null;
};
export declare const org: BotCommand;
//# sourceMappingURL=org.d.ts.map