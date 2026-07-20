import { ButtonInteraction, ChannelSelectMenuInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { CommandAnalytics } from './commandAnalytics';
import type { CooldownManager } from './cooldownManager';
import { type InteractionDeferMode } from './deferInteraction';
import { type InteractionErrorClass } from './interactionErrorTaxonomy';
export type InteractionKind = 'slash' | 'button' | 'modal' | 'select';
type ExecutableInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction;
export declare function interactionCooldownMessage(remainingSeconds: number): string;
export declare function consumeInteractionCooldown(cooldownKey: string, userId: string, cooldownSeconds: number, cooldownManager: CooldownManager): Promise<number>;
export declare function interactionErrorMessage(kind: InteractionKind, errorClass: InteractionErrorClass): string;
export declare function trackInteractionLatency(kind: InteractionKind, commandName: string, durationMs: number, success: boolean, guildId?: string, errorClass?: InteractionErrorClass): void;
export interface ExecuteInteractionOptions {
    interaction: ExecutableInteraction;
    kind: InteractionKind;
    analyticsLabel: string;
    cooldownKey: string;
    cooldownSeconds: number;
    cooldownManager: CooldownManager;
    commandAnalytics?: CommandAnalytics;
    defer?: InteractionDeferMode;
    run: () => Promise<void>;
}
export declare function executeInteraction(options: ExecuteInteractionOptions): Promise<void>;
export {};
//# sourceMappingURL=interactionExecutor.d.ts.map