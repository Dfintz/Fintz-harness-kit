import { channelMention } from 'discord.js';

import type { VoiceChannelSettings } from '../../models/DiscordGuildSettings';

/**
 * Temporary-voice hub helpers shared by the bot's settings displays.
 *
 * Hub channels are persisted in two places: the legacy singular `hubChannelId` and the newer
 * `hubChannelIds` array (multi-hub). The web dashboard writes to the array, while older configs
 * may still use the singular field. `voiceAutoCreate.ts` (the feature that actually creates temp
 * channels) treats the union of both as the source of truth, so every report/status display must
 * do the same — reading only `hubChannelId` mis-reports a configured hub as "not set".
 */

/** Deduped, non-empty union of the singular `hubChannelId` and the `hubChannelIds` array. */
export function getConfiguredVoiceHubs(vc?: VoiceChannelSettings): string[] {
  return [
    ...new Set(
      [vc?.hubChannelId, ...(vc?.hubChannelIds ?? [])].filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    ),
  ];
}

/** Render configured hub channels as Discord mentions, or `*not set*` when none are configured. */
export function formatVoiceHubs(vc?: VoiceChannelSettings): string {
  const hubs = getConfiguredVoiceHubs(vc);
  return hubs.length > 0 ? hubs.map(channelMention).join(', ') : '*not set*';
}
