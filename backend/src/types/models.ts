/**
 * Model-specific types
 *
 * Type definitions for model properties that use JSON/JSONB storage
 */

/**
 * User preferences stored in User.preferences
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
    discord?: boolean;
    digest?: boolean;
  };
  privacy?: {
    profileVisibility?: 'public' | 'organization' | 'private';
    showEmail?: boolean;
    showDiscord?: boolean;
    /** Show bio/about text on public profile */
    showBio?: boolean;
    /** Show RSI handle and trust score on public profile */
    showRsiInfo?: boolean;
    /** Show RSI verified badge on public profile */
    showVerifiedBadge?: boolean;
    /** Show organization memberships and ranks on public profile */
    showOrganizations?: boolean;
    /** Show ships marked as public on public profile */
    showPublicShips?: boolean;
    /** Show SCStats gameplay metrics on public profile */
    showScStats?: boolean;
    /** Show activity history on public profile */
    showActivity?: boolean;
  };
  display?: {
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
    currency?: string;
  };
}

/**
 * Ship customization data stored in UserShip.modifications.customization
 */
export interface ShipCustomization {
  paintScheme?: string;
  decals?: string[];
  interior?: string;
  lighting?: string;
  nameplate?: string;
  [key: string]: unknown;
}

/**
 * Activity participant metadata
 */
export interface ParticipantMetadata {
  joinedFrom?: string;
  invitedBy?: string;
  specialRole?: string;
  equipment?: string[];
  preferences?: {
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Activity metadata stored in Activity.metadata
 */
export interface ActivityMetadata {
  source?: string;
  importedFrom?: string;
  externalId?: string;
  tags?: string[];
  customFields?: {
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Organization template field default value
 */
export type TemplateFieldDefaultValue = string | number | boolean | string[] | null;

/**
 * External integration configuration
 */
export interface IntegrationConfig {
  apiKey?: string;
  webhookUrl?: string;
  enabled?: boolean;
  settings?: {
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Ship loadout components
 */
export interface ShipLoadoutComponents {
  weapons?: Array<{
    slot: string;
    item: string;
    size?: number;
  }>;
  shields?: Array<{
    slot: string;
    item: string;
  }>;
  powerPlant?: {
    item: string;
    size?: number;
  };
  coolers?: Array<{
    slot: string;
    item: string;
  }>;
  quantum?: {
    drive: string;
    fuel?: string;
  };
  [key: string]: unknown;
}

/**
 * Briefing data structure
 */
export interface BriefingData {
  objectives?: string[];
  threats?: string[];
  resources?: string[];
  intel?: string[];
  notes?: string;
  [key: string]: unknown;
}

/**
 * Organization deletion request data
 */
export interface DeletionRequestData {
  reason?: string;
  requestedBy?: string;
  requestedAt?: string;
  approvals?: Array<{
    userId: string;
    timestamp: string;
  }>;
  [key: string]: unknown;
}

/**
 * Summary object returned by model getSummary() methods
 */
export interface ModelSummary {
  id: string;
  [key: string]: unknown;
}

/**
 * Event attendance confirmation summary
 */
export interface AttendanceConfirmationSummary extends ModelSummary {
  userId: string;
  eventId: string;
  status: string;
  confirmedAt?: string;
  rsvpStatus?: string;
  rsvpRole?: string;
  actualRole?: string;
  attendanceScore?: number;
  excusedAbsence?: boolean;
  confirmedBy?: string;
  durationMinutes?: number;
}

/**
 * Organization relationship summary
 */
export interface OrganizationRelationshipSummary extends ModelSummary {
  orgId1: string;
  orgId2: string;
  relationship: string;
  status: string;
  allianceType?: string;
  type?: string;
  trustScore?: number;
  trustLevel?: string;
  relationshipStrength?: number;
  strengthLevel?: string;
  healthScore?: number;
  tier?: string | number;
  interactionCount?: number;
  positiveRatio?: number | string;
  lastInteraction?: Date | string;
  needsReview?: boolean;
  isExpired?: boolean;
  isMutual?: boolean;
}

/**
 * Generic relation object used in bot commands
 */
export interface RelationObject {
  id: string;
  orgId1: string;
  orgId2: string;
  status: 'active' | 'proposed' | 'suspended';
  relationship: 'allied' | 'neutral' | 'hostile';
  allianceType?: string;
  [key: string]: unknown;
}

/**
 * Incident object for diplomatic relations
 */
export interface DiplomaticIncident {
  id: string;
  description: string;
  resolved: boolean;
  createdAt?: Date | string;
  resolvedAt?: Date | string;
  severity?: string;
  [key: string]: unknown;
}

/**
 * Ticket message object
 */
export interface TicketMessage {
  id: string;
  authorName: string;
  content: string;
  createdAt: Date | string;
  isInternal: boolean;
  [key: string]: unknown;
}

/**
 * Organization relationship object for org commands
 */
export interface OrgRelationship {
  id: string;
  targetOrgId: string;
  relationship: 'allied' | 'neutral' | 'hostile';
  [key: string]: unknown;
}
