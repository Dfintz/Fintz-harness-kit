import { ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { ActivityType } from '../../models/Activity';
type VoiceChannelMode = 'none' | 'current' | 'temp';
export interface WizardSessionState {
    title?: string;
    description?: string;
    activityType: ActivityType;
    scheduledStartDate?: Date;
    estimatedDuration?: number;
    location?: string;
    difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
    maxParticipants?: number;
    voiceChannelMode: VoiceChannelMode;
    voiceChannelLimit?: number;
    requirements?: string;
    guildId: string;
    channelId: string;
    userId: string;
    userName: string;
    lastInteraction: number;
}
type WizardLaunchInteraction = ButtonInteraction | ChatInputCommandInteraction;
export declare function launchEventCreationWizard(interaction: WizardLaunchInteraction): Promise<void>;
export declare function handleWizardButton(interaction: ButtonInteraction): Promise<void>;
export declare function handleWizardModal(interaction: ModalSubmitInteraction): Promise<void>;
export declare function handleWizardSelectMenu(interaction: StringSelectMenuInteraction): Promise<void>;
export declare function isWizardButtonId(customId: string): boolean;
export declare function isWizardModalId(customId: string): boolean;
export declare function isWizardSelectId(customId: string): boolean;
export {};
//# sourceMappingURL=eventCreationWizard.d.ts.map