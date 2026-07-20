import { ButtonInteraction } from 'discord.js';
declare function handleOpenActionsPanel(interaction: ButtonInteraction, activityId: string): Promise<void>;
declare function handleRemindMe(interaction: ButtonInteraction, activityId: string): Promise<void>;
declare function ephemeralLeaveConfirmation(action: string): string;
export { ephemeralLeaveConfirmation, handleOpenActionsPanel, handleRemindMe };
//# sourceMappingURL=eventButtons.panelReminder.d.ts.map