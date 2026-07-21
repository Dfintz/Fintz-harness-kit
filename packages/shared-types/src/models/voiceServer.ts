/**
 * Voice Server — Shared Types
 *
 * Types for external voice server integration (Mumble, TeamSpeak, Ventrilo, StarComms).
 * Used by both backend (VoiceServerService) and frontend (voice stats page).
 */

// ─── Server Configuration ────────────────────────────────────────

/** Supported external voice server protocols */
export type VoiceServerType = 'mumble' | 'teamspeak' | 'ventrilo' | 'starcomms' | 'custom';

/** Hosting/power mode for StarComms voice servers. */
export type StarCommsVoiceMode = 'central' | 'private';

/**
 * Connection config stored in org/federation settings jsonb.
 * Passwords are encrypted at rest and never returned to the frontend.
 */
export interface VoiceServerConfig {
  /** Whether voice server integration is enabled */
  enabled: boolean;
  /** Voice server protocol */
  serverType: VoiceServerType;
  /** StarComms mode when serverType='starcomms' (central-hosted vs private shard). */
  starCommsVoiceMode?: StarCommsVoiceMode;
  /** Server hostname or IP */
  host: string;
  /** Server port (1-65535) */
  port: number;
  /** Display name shown in the UI */
  displayName?: string;
  /**
   * Whether a connection password is set.
   * Actual password is encrypted and stored server-side only.
   */
  hasPassword?: boolean;
  /** Deep link URL for one-click connect (e.g., mumble://host:port/) */
  connectUrl?: string;
  /** TeamSpeak ServerQuery TCP port (default: 10011) */
  queryPort?: number;
  /** TeamSpeak ServerQuery username */
  queryUsername?: string;
  /** Whether a TeamSpeak ServerQuery password is set */
  hasQueryPassword?: boolean;
  /** Whether this is the platform-hosted server (e.g. SNC Mumble) */
  isPlatformHosted?: boolean;
  /** RBAC: minimum org role priority required to access (0 = all members) */
  minRolePriority?: number;
  /** RBAC: specific permission key required (e.g., 'voice:connect') */
  requiredPermission?: string;
  /**
   * Whether Mumble voice minutes should contribute to the CAS Voice Activity score.
   * Only applicable for servers with ICE/gRPC query support.
   */
  contributeToCAS?: boolean;
  /** ICE (ZeroC ICE) host for Mumble server RPC — enables channel tree + user data */
  iceHost?: string;
  /** ICE port (typically 6502) */
  icePort?: number;
  /** ICE secret for Mumble server authentication */
  hasIceSecret?: boolean;
  /** Federation / 3rd-party sharing configuration */
  sharing?: VoiceServerSharingConfig;
}

/**
 * Input DTO for creating/updating voice server config.
 * Password is sent in plaintext and encrypted server-side.
 */
export interface UpdateVoiceServerConfigRequest {
  enabled: boolean;
  serverType: VoiceServerType;
  /** StarComms mode when serverType='starcomms'. */
  starCommsVoiceMode?: StarCommsVoiceMode;
  host: string;
  port: number;
  displayName?: string;
  /** Plaintext password — encrypted before storage, omit to keep existing */
  password?: string;
  connectUrl?: string;
  /** TeamSpeak ServerQuery TCP port (default: 10011) */
  queryPort?: number;
  /** TeamSpeak ServerQuery username */
  queryUsername?: string;
  /** TeamSpeak ServerQuery password — encrypted before storage, omit to keep existing */
  queryPassword?: string;
  isPlatformHosted?: boolean;
  minRolePriority?: number;
  requiredPermission?: string;
  contributeToCAS?: boolean;
  /** ICE host for Mumble RPC (enables channel tree + user list) */
  iceHost?: string;
  /** ICE port (default: 6502) */
  icePort?: number;
  /** ICE secret for authentication — encrypted before storage, omit to keep existing */
  iceSecret?: string;
  /** Federation / 3rd-party sharing configuration */
  sharing?: UpdateVoiceServerSharingRequest;
}

// ─── Federation / 3rd-Party Sharing ──────────────────────────────

/** Type of entity that can be whitelisted for voice server access */
export type VoiceServerShareTargetType = 'federation' | 'organization';

/** A single whitelist entry granting access to a federation or organization */
export interface VoiceServerShareEntry {
  /** Target type: federation or organization */
  type: VoiceServerShareTargetType;
  /** Federation UUID or Organization ID */
  targetId: string;
  /** Display name for the UI (denormalized for convenience) */
  targetName: string;
  /** When this entry was added (ISO-8601) */
  addedAt: string;
  /** Who added this entry (user ID) */
  addedBy?: string;
}

/** Sharing configuration stored alongside VoiceServerConfig */
export interface VoiceServerSharingConfig {
  /** Whether sharing is enabled */
  enabled: boolean;
  /** Whitelisted federations and organizations that can access this voice server */
  whitelist: VoiceServerShareEntry[];
}

/** Source of a suggested whitelist entry for auto-population */
export type VoiceServerSuggestionSource =
  'federation_membership' | 'alliance_diplomacy' | 'organization_relationship';

/**
 * A suggested whitelist entry derived from federation memberships or
 * positive diplomacy relationships.  Returned by the suggestions endpoint.
 */
export interface VoiceServerWhitelistSuggestion {
  type: VoiceServerShareTargetType;
  targetId: string;
  targetName: string;
  /** Where the suggestion comes from */
  source: VoiceServerSuggestionSource;
  /** Human-readable label for the source (e.g. "Full Alliance", "Trading Partner") */
  sourceLabel: string;
  /** Whether this entry is already in the current whitelist */
  alreadyWhitelisted: boolean;
}

/** Input DTO for updating sharing configuration */
export interface UpdateVoiceServerSharingRequest {
  enabled: boolean;
  whitelist: Array<{
    type: VoiceServerShareTargetType;
    targetId: string;
    targetName: string;
  }>;
}

// ─── Server Status (Real-time) ───────────────────────────────────

/** Real-time server state from ICE/ServerQuery */
export interface VoiceServerStatus {
  online: boolean;
  currentUsers: number;
  maxUsers: number;
  uptimeSeconds?: number;
  bandwidthKbps?: number;
  channels?: VoiceServerChannel[];
}

/** A channel on the voice server */
export interface VoiceServerChannel {
  id: number;
  name: string;
  parentId: number | null;
  userCount: number;
  users?: VoiceServerUser[];
}

/** A connected user on the voice server */
export interface VoiceServerUser {
  /** Platform user ID (if linked via certificate) */
  platformUserId?: string;
  /** Display name on the voice server */
  displayName: string;
  /** Channel the user is in */
  channelId: number;
  isMuted: boolean;
  isDeafened: boolean;
  /** ISO-8601 timestamp of when they connected */
  onlineSince: string;
  /** Session duration in minutes */
  sessionMinutes?: number;
}

// ─── Statistics (Aggregated) ─────────────────────────────────────

/** Aggregated stats for the QoL stats page */
export interface VoiceServerStats {
  serverType: VoiceServerType;
  displayName: string;
  status: VoiceServerStatus;
  /** Peak concurrent users in last 24 hours */
  peakUsers24h?: number;
  /** Peak concurrent users in last 7 days */
  peakUsers7d?: number;
  /** Peak concurrent users in last 30 days */
  peakUsers30d?: number;
  /** Average session duration in minutes */
  avgSessionMinutes?: number;
  /** Total unique users this month */
  uniqueUsersMonth?: number;
  /** Total voice minutes this month (for CAS integration) */
  totalVoiceMinutesMonth?: number;
}

// ─── Accessible Voice Servers (Aggregated List) ──────────────────

/** Why a voice server is accessible to the current user */
export type AccessibleVoiceServerScope =
  | 'organization' // Server owned by one of the user's orgs
  | 'federation' // Server owned by a federation the user's org belongs to
  | 'shared'; // Server owned by another org/federation that whitelisted the user's org or federation

/**
 * A voice server the current user has access to, with sanitised config and
 * the source (own org, federation, or third-party share) that grants access.
 *
 * Returned by `GET /api/v2/voice-server/accessible`.
 */
export interface AccessibleVoiceServer {
  /** Why this server is visible to the user */
  scope: AccessibleVoiceServerScope;
  /** The owning entity type (organization or federation) */
  ownerType: 'organization' | 'federation';
  /** UUID of the owning organization or federation */
  ownerId: string;
  /** Display name of the owning organization or federation */
  ownerName: string;
  /** Sanitised voice server config (no passwords or ICE secrets) */
  config: VoiceServerConfig;
  /** Live status (online users, channels). Null if status query failed. */
  status?: VoiceServerStatus | null;
}
