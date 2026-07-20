import { ButtonInteraction, type InteractionReplyOptions } from 'discord.js';
export declare const CONFIRMATION_CANCELLED_MESSAGE = "\u274E Cancelled \u2014 no changes were made.";
export interface ConfirmationPromptOptions {
    confirmCustomId: string;
    cancelCustomId: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmEmoji?: string;
    cancelEmoji?: string;
    content?: string;
}
export declare function confirmationQuestion(message: string): string;
export declare function buildConfirmationPrompt(options: ConfirmationPromptOptions): InteractionReplyOptions;
export declare function respondConfirmationCancelled(interaction: ButtonInteraction, message?: string): Promise<void>;
//# sourceMappingURL=confirmationPrompt.d.ts.map