// Re-export BotCommand type from types.ts
export type { BotCommand } from './types';

// ========================================================================
// Registered commands — these are the slash commands deployed to Discord.
// After Phase 6 full flattening, ALL commands are now standalone.
// ========================================================================

// Standalone commands
export { analytics } from './analytics';
export { help } from './help';
export { ping } from './ping';
export { verify } from './verify';

// Promoted standalone commands (formerly nested under parent groups)
export { attendanceCommand as attend } from './attend';
export { bounty } from './bounty';
export { briefing } from './briefing';
export { commlink } from './commlink';
export { diplomacy } from './diplomacy';
export { discover } from './discover';
export { events } from './events';
export { hunter } from './hunter';
export { lfg } from './lfg';
export { mission } from './mission';
export { moderation } from './moderation';
export { notify } from './notify';
export { org } from './org';
export { recruitment } from './recruitment';
export { reminder } from './reminder';
export { schedule } from './schedule';
export { stats } from './stats';
export { ticket } from './ticket';
export { user } from './user';
export { voice } from './voice';

// Dedicated panel commands (separate panels for key features)
export { federation } from './federation';
export { guild } from './guild';
export { readycheck } from './readycheck';

// Combined panel commands — aggregate multiple features for discoverability
// /help now integrates wiki + FAQ sub-panels alongside command listing
// /community combines giveaway, poll, announce, embed, roles into one panel
export { community } from './community';

// Standalone feature commands — also accessible via /community sub-panels
// Kept as dedicated commands for quick access and direct button/modal routing
export { announce } from './announce';
export { embed } from './embed';
export { faq } from './faq';
export { giveaway } from './giveaway';
export { poll } from './poll';
export { roles } from './roles';
export { rsistatus } from './rsistatus';
export { rsisync } from './rsisync';
export { wiki } from './wiki';
