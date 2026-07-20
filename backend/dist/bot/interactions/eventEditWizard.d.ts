import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
declare const RECURRENCE_CHOICES: readonly ["none", "daily", "weekly", "monthly"];
type RecurrenceChoice = (typeof RECURRENCE_CHOICES)[number];
export declare function normalizeRecurrenceInput(patternRaw: string, endRaw: string): {
    ok: true;
    pattern: RecurrenceChoice;
    endDate?: Date;
} | {
    ok: false;
    error: string;
};
export declare function isEditWizardButtonId(customId: string): boolean;
export declare function isEditWizardModalId(customId: string): boolean;
export declare function launchEventEditWizard(interaction: ButtonInteraction, activityId: string): Promise<void>;
export declare function handleEditWizardButton(interaction: ButtonInteraction): Promise<void>;
export declare function handleEditWizardModal(interaction: ModalSubmitInteraction): Promise<void>;
export {};
//# sourceMappingURL=eventEditWizard.d.ts.map