import { ButtonInteraction, MessageFlags } from 'discord.js';

import { ReminderChannel } from '../../models/ActivityReminder';
import { buildEventActionPanelComponents } from '../embeds/eventEmbed';

import { getActivityService, getReminderService } from './eventButtons.services';
import { pickReminderOffset } from './eventReminderOffset';

const MSG_ACTIVITY_NOT_FOUND = '⚠️ Activity no longer exists.';

async function handleOpenActionsPanel(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  await interaction.reply({
    content: '🚀 **Ship & Crew** — choose an action:',
    components: buildEventActionPanelComponents(activityId),
    flags: MessageFlags.Ephemeral,
  });
}

async function handleRemindMe(interaction: ButtonInteraction, activityId: string): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const activity = await getActivityService().getActivityById(activityId);
  if (!activity) {
    await interaction.editReply({ content: MSG_ACTIVITY_NOT_FOUND });
    return;
  }
  if (!activity.scheduledStartDate) {
    await interaction.editReply({
      content: '⚠️ This event has no scheduled time, so a reminder cannot be set.',
    });
    return;
  }

  const choice = pickReminderOffset(new Date(activity.scheduledStartDate));
  if (!choice) {
    await interaction.editReply({
      content: '⏰ This event is too soon to set a reminder.',
    });
    return;
  }

  const discordUserId = interaction.user.id;

  try {
    const existing = await getReminderService().getActivityReminders(activityId);
    const now = Date.now();
    const alreadySet = existing.some(
      r => r.recipientUserIds?.includes(discordUserId) && new Date(r.scheduledTime).getTime() > now
    );
    if (alreadySet) {
      await interaction.editReply({
        content: '🔔 You already have a reminder set for this event.',
      });
      return;
    }
  } catch {
    // Non-fatal — fall through and create the reminder.
  }

  await getReminderService().createActivityReminders(
    activityId,
    [choice.type],
    ReminderChannel.DISCORD,
    [discordUserId]
  );

  const fireAtTs = Math.floor(choice.fireAt.getTime() / 1000);
  await interaction.editReply({
    content: `🔔 You'll be reminded **${choice.label}** (<t:${fireAtTs}:F>) for **${activity.title}**.`,
  });
}

function ephemeralLeaveConfirmation(action: string): string {
  if (action === 'leavecrew') {
    return '✅ You left the ship crew.';
  }
  if (action === 'leavepassenger') {
    return '✅ You left your passenger seat.';
  }
  return '✅ Done.';
}

export { ephemeralLeaveConfirmation, handleOpenActionsPanel, handleRemindMe };
