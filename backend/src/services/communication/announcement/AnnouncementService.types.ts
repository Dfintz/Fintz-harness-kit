/**
 * AnnouncementService DTOs and result shapes.
 *
 * Extracted from `AnnouncementService.ts` (E5 large-file decomposition) to establish a
 * types/logic ownership boundary on the communication domain's largest service. The
 * service module re-exports every interface below, so all existing
 * `./AnnouncementService` and `services/communication/announcement` barrel import
 * paths are preserved.
 */
import type { EmbedBuilder } from 'discord.js';

import type {
  Announcement,
  AnnouncementDeliveryResult,
  AnnouncementEmbedConfig,
  AnnouncementStatus,
  AnnouncementTargetType,
} from '../../../models/Announcement';
import type { AnnouncementDelivery } from '../../../models/AnnouncementDelivery';

/**
 * Create Announcement DTO
 */
export interface CreateAnnouncementDTO {
  title: string;
  content: string;
  createdBy: string;
  createdByName?: string;
  embedConfig?: AnnouncementEmbedConfig;
  targetType?: AnnouncementTargetType;
  targetIds?: string[];
  scheduledAt?: Date;
}

/**
 * Update Announcement DTO
 */
export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  embedConfig?: AnnouncementEmbedConfig;
  targetType?: AnnouncementTargetType;
  targetIds?: string[];
  scheduledAt?: Date;
  status?: AnnouncementStatus;
}

/**
 * Announcement filters for queries
 */
export interface AnnouncementFilters {
  status?: AnnouncementStatus | AnnouncementStatus[];
  createdBy?: string;
  targetType?: AnnouncementTargetType;
}

/**
 * Embed preview result
 */
export interface EmbedPreview {
  embed: EmbedBuilder;
  announcement: Announcement;
}

/**
 * Delivery result
 */
export interface DeliveryResult {
  announcementId: string;
  success: boolean;
  totalTargets: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  results: AnnouncementDeliveryResult[];
}

/**
 * Multi-server delivery result (Phase 2)
 */
export interface MultiServerDeliveryResult {
  announcementId: string;
  success: boolean;
  totalServers: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  deliveries: AnnouncementDelivery[];
}

/**
 * Alliance delivery result (Phase 3)
 */
export interface AllianceDeliveryResult extends MultiServerDeliveryResult {
  allianceOrgs: string[]; // List of alliance organization IDs involved
  skippedOrgs: string[]; // Orgs without linked Discord servers
  skippedReasons: Record<string, string>; // Reason for each skipped org
}

/**
 * Announcement status with delivery details (Phase 2)
 */
export interface AnnouncementStatusResult {
  announcement: Announcement;
  deliveries: AnnouncementDelivery[];
  summary: {
    total: number;
    pending: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
}

// ========================================
// Phase 4: Template and Global Broadcast DTOs
// ========================================

/**
 * Create Template DTO
 */
export interface CreateTemplateDTO {
  name: string;
  title?: string;
  content: string;
  embedConfig?: AnnouncementEmbedConfig;
  isGlobal?: boolean;
  createdBy: string;
  createdByName?: string;
}

/**
 * Update Template DTO
 */
export interface UpdateTemplateDTO {
  name?: string;
  title?: string;
  content?: string;
  embedConfig?: AnnouncementEmbedConfig;
}

/**
 * Template filters for queries
 */
export interface TemplateFilters {
  isGlobal?: boolean;
  createdBy?: string;
}

/**
 * Global broadcast result (Phase 4)
 */
export interface GlobalBroadcastResult extends MultiServerDeliveryResult {
  totalGuilds: number; // Total Discord guilds in the platform
  reachableGuilds: number; // Guilds the bot can access
  skippedGuilds: string[]; // Guild IDs that were skipped
  skippedReasons: Record<string, string>; // Reason for each skipped guild
  confirmationRequired: boolean; // Whether confirmation was required
  confirmedBy?: string; // User who confirmed the broadcast
}

