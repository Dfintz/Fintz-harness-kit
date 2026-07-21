/**
 * Internal API base URL for bot commands.
 *
 * Prefers BOT_API_INTERNAL_URL (same-container HTTP) over API_BASE_URL (external HTTPS)
 * to avoid TLS round-trips when the bot and API are co-located.
 */
export const API_BASE_URL =
  process.env.BOT_API_INTERNAL_URL || process.env.API_BASE_URL || 'http://localhost:3000/api';
