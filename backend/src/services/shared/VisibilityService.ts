/**
 * VisibilityService — Viewer-sensitive entity filtering.
 *
 * Determines whether a viewer can see full details of an entity,
 * or should receive a redacted representation.
 *
 * Rules:
 *  - Public entities → always visible
 *  - Entity members → see full details
 *  - Platform admins → see full details
 *  - Others → redacted representation
 */

import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface RedactedEntity {
  id: string;
  name: string;
  isPublic: false;
  isRedacted: true;
}

interface VisibleEntity {
  id: string;
  isPublic?: boolean;
}

// ── Service ─────────────────────────────────────────────────────────

export class VisibilityService {
  /**
   * Check if a viewer can see full details of an entity.
   *
   * @param entityId - The entity being viewed
   * @param isPublic - Whether the entity is public
   * @param _viewerId - Reserved for future per-user visibility rules
   * @param viewerMembershipIds - Entity IDs the viewer is a member of
   * @param isPlatformAdmin - Whether the viewer is a platform admin
   */
  canViewFull(
    entityId: string,
    isPublic: boolean,
    _viewerId: string,
    viewerMembershipIds: string[],
    isPlatformAdmin: boolean = false
  ): boolean {
    // Public entities are always visible
    if (isPublic) {
      return true;
    }

    // Platform admins can see everything
    if (isPlatformAdmin) {
      return true;
    }

    // Members of the entity can see full details
    if (viewerMembershipIds.includes(entityId)) {
      return true;
    }

    return false;
  }

  /**
   * Filter a list of entities, replacing non-visible ones with redacted representations.
   *
   * @param entities - Entities to filter
   * @param viewerId - The viewer's user ID
   * @param viewerMembershipIds - Entity IDs the viewer is a member of
   * @param isPlatformAdmin - Whether the viewer is a platform admin
   * @param entityType - Type of entity for redacted label
   */
  redactForViewer<T extends VisibleEntity>(
    entities: T[],
    viewerId: string,
    viewerMembershipIds: string[],
    isPlatformAdmin: boolean = false,
    entityType: 'organization' | 'alliance' = 'organization'
  ): Array<T | RedactedEntity> {
    const redactedLabel =
      entityType === 'organization' ? 'Private Organization' : 'Private Alliance';

    return entities.map(entity => {
      const canView = this.canViewFull(
        entity.id,
        entity.isPublic ?? false, // Default to non-public for safety
        viewerId,
        viewerMembershipIds,
        isPlatformAdmin
      );

      if (canView) {
        return entity;
      }

      logger.debug(`Redacting ${entityType} ${entity.id} for viewer ${viewerId}`);

      return {
        id: entity.id,
        name: redactedLabel,
        isPublic: false as const,
        isRedacted: true as const,
      };
    });
  }
}

