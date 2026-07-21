import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { OrganizationArchiveService } from '../../services/organization/OrganizationArchiveService';
import { ResourceArchiveService } from '../../services/organization/ResourceArchiveService';
import { BaseController } from '../BaseController';

const SUPPORTED_RESOURCE_TYPES = ['organization', 'fleet'] as const;
type ArchiveResourceType = (typeof SUPPORTED_RESOURCE_TYPES)[number];

/**
 * Archive Controller (v2)
 *
 * Manages org-scoped archive operations — soft-delete archival, restore,
 * permanent deletion, and archive search/statistics.
 *
 * Supports organization-level and resource-level (fleet) archival.
 */
export class ArchiveController extends BaseController {
  private readonly archiveService: OrganizationArchiveService;
  private readonly resourceArchiveService: ResourceArchiveService;

  constructor() {
    super();
    this.archiveService = OrganizationArchiveService.getInstance();
    this.resourceArchiveService = ResourceArchiveService.getInstance();
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { page, limit, resourceType } = req.query as Record<string, string>;

      // Collect archived items by type
      interface ArchivedItem {
        id: string;
        resourceType: string;
        resourceId: string;
        name: string;
        archivedAt?: Date;
        archivedBy?: string;
        reason?: string;
      }
      const items: ArchivedItem[] = [];

      if (!resourceType || resourceType === 'organization') {
        const archivedOrgs = await this.archiveService.getArchivedOrganizations();
        for (const org of archivedOrgs) {
          items.push({
            id: org.id,
            resourceType: 'organization',
            resourceId: org.id,
            name: org.name,
            archivedAt: org.archivedAt,
            archivedBy: org.archivedBy,
            reason: org.archiveReason,
          });
        }
      }

      if (!resourceType || resourceType === 'fleet') {
        const archivedFleets = await this.resourceArchiveService.getArchivedFleets(organizationId);
        for (const fleet of archivedFleets) {
          items.push({
            id: fleet.id,
            resourceType: 'fleet',
            resourceId: fleet.id,
            name: fleet.name,
            archivedAt: fleet.archivedAt,
            archivedBy: fleet.archivedBy,
            reason: fleet.archiveReason,
          });
        }
      }

      const pageNum = Number.parseInt(page) || 1;
      const pageSize = Math.min(Number.parseInt(limit) || 20, 200);
      const start = (pageNum - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);

      res.json({
        success: true,
        data: paged,
        pagination: {
          total: items.length,
          count: paged.length,
          page: pageNum,
          pageSize,
          hasMore: start + pageSize < items.length,
          totalPages: Math.ceil(items.length / pageSize),
        },
      });
    });
  };

  archive = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = this.getOrganizationId(req);
      const { resourceType, resourceId, reason } = req.body as {
        resourceType: string;
        resourceId: string;
        reason?: string;
      };

      const type = (resourceType || 'organization') as ArchiveResourceType;
      if (!SUPPORTED_RESOURCE_TYPES.includes(type)) {
        res
          .status(400)
          .json({ success: false, message: `Unsupported resource type: ${resourceType}` });
        return;
      }

      if (type === 'fleet') {
        const archived = await this.resourceArchiveService.archiveFleet(
          resourceId,
          organizationId,
          user.id,
          reason
        );
        res.status(201).json({
          success: true,
          data: {
            id: archived.id,
            resourceType: 'fleet',
            resourceId: archived.id,
            name: archived.name,
            archivedBy: user.id,
            archivedAt: archived.archivedAt?.toISOString(),
            reason: archived.archiveReason,
          },
        });
        return;
      }

      const archived = await this.archiveService.archiveOrganization(resourceId, user.id, reason);
      res.status(201).json({
        success: true,
        data: {
          id: archived.id,
          resourceType: 'organization',
          resourceId: archived.id,
          name: archived.name,
          archivedBy: user.id,
          archivedAt: archived.archivedAt?.toISOString(),
          reason: archived.archiveReason,
        },
      });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { archiveId } = req.params;
      const { resourceType } = req.query as Record<string, string>;

      // Try fleet first if requested, then fall back to organization
      if (resourceType === 'fleet') {
        const fleet = await this.resourceArchiveService.getArchivedFleetById(
          archiveId,
          organizationId
        );
        if (fleet) {
          res.json({
            success: true,
            data: {
              id: fleet.id,
              resourceType: 'fleet',
              resourceId: fleet.id,
              name: fleet.name,
              description: fleet.description,
              archivedAt: fleet.archivedAt,
              archivedBy: fleet.archivedBy,
              reason: fleet.archiveReason,
            },
          });
          return;
        }
      }

      // Check organizations
      const archivedOrgs = await this.archiveService.getArchivedOrganizations();
      const org = archivedOrgs.find(o => o.id === archiveId);

      if (!org) {
        // If no type filter, also check fleets
        if (!resourceType) {
          const fleet = await this.resourceArchiveService.getArchivedFleetById(
            archiveId,
            organizationId
          );
          if (fleet) {
            res.json({
              success: true,
              data: {
                id: fleet.id,
                resourceType: 'fleet',
                resourceId: fleet.id,
                name: fleet.name,
                description: fleet.description,
                archivedAt: fleet.archivedAt,
                archivedBy: fleet.archivedBy,
                reason: fleet.archiveReason,
              },
            });
            return;
          }
        }
        res.status(404).json({ success: false, message: 'Archived item not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: org.id,
          resourceType: 'organization',
          resourceId: org.id,
          name: org.name,
          description: org.description,
          archivedAt: org.archivedAt,
          archivedBy: org.archivedBy,
          reason: org.archiveReason,
        },
      });
    });
  };

  restore = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = this.getOrganizationId(req);
      const { archiveId } = req.params;
      const { resourceType } = req.body as { resourceType?: string };

      if (resourceType === 'fleet') {
        const restored = await this.resourceArchiveService.restoreFleet(
          archiveId,
          organizationId,
          user.id
        );
        res.json({
          success: true,
          data: {
            id: restored.id,
            resourceType: 'fleet',
            resourceId: restored.id,
            name: restored.name,
            restoredBy: user.id,
            restoredAt: restored.restoredAt?.toISOString(),
          },
        });
        return;
      }

      const restored = await this.archiveService.restoreOrganization(archiveId, user.id);
      res.json({
        success: true,
        data: {
          id: restored.id,
          resourceType: 'organization',
          resourceId: restored.id,
          name: restored.name,
          restoredBy: user.id,
          restoredAt: restored.restoredAt?.toISOString(),
        },
      });
    });
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = this.getOrganizationId(req);
      const { archiveId } = req.params;
      const { resourceType } = req.query as Record<string, string>;

      if (resourceType === 'fleet') {
        await this.resourceArchiveService.permanentlyDeleteFleet(
          archiveId,
          organizationId,
          user.id
        );
      } else {
        await this.archiveService.permanentlyDelete(archiveId, user.id);
      }

      res.json({
        success: true,
        data: {
          id: archiveId,
          resourceType: resourceType || 'organization',
          permanentlyDeleted: true,
        },
      });
    });
  };

  getStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);

      const archivedOrgs = await this.archiveService.getArchivedOrganizations();
      const pendingDeletion = await this.archiveService.getOrganizationsPendingDeletion();
      const archivedFleetCount =
        await this.resourceArchiveService.getArchivedFleetCount(organizationId);

      res.json({
        success: true,
        data: {
          totalArchived: archivedOrgs.length + archivedFleetCount,
          pendingDeletion: pendingDeletion.length,
          byType: {
            organization: archivedOrgs.length,
            fleet: archivedFleetCount,
          },
        },
      });
    });
  };

  bulkArchive = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { records } = req.body as {
        records: Array<{
          resourceType: string;
          resourceId: string;
          reason?: string;
        }>;
      };

      let archived = 0;
      const errors: Array<{ resourceId: string; error: string }> = [];

      const organizationId = this.getOrganizationId(req);

      for (const record of records || []) {
        try {
          if (record.resourceType === 'fleet') {
            await this.resourceArchiveService.archiveFleet(
              record.resourceId,
              organizationId,
              user.id,
              record.reason
            );
          } else {
            await this.archiveService.archiveOrganization(
              record.resourceId,
              user.id,
              record.reason
            );
          }
          archived++;
        } catch (err) {
          errors.push({
            resourceId: record.resourceId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          archivedBy: user.id,
          requested: records?.length || 0,
          archived,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    });
  };

  search = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { q, page, limit, resourceType } = req.query as Record<string, string>;
      const query = q?.toLowerCase();

      interface ArchivedItem {
        id: string;
        resourceType: string;
        resourceId: string;
        name: string;
        archivedAt?: Date;
        archivedBy?: string;
        reason?: string;
      }
      const items: ArchivedItem[] = [];

      if (!resourceType || resourceType === 'organization') {
        const archivedOrgs = await this.archiveService.getArchivedOrganizations();
        const filtered = query
          ? archivedOrgs.filter(
              org =>
                org.name?.toLowerCase().includes(query) ||
                org.description?.toLowerCase().includes(query) ||
                org.archiveReason?.toLowerCase().includes(query)
            )
          : archivedOrgs;
        for (const org of filtered) {
          items.push({
            id: org.id,
            resourceType: 'organization',
            resourceId: org.id,
            name: org.name,
            archivedAt: org.archivedAt,
            archivedBy: org.archivedBy,
            reason: org.archiveReason,
          });
        }
      }

      if (!resourceType || resourceType === 'fleet') {
        const archivedFleets = await this.resourceArchiveService.getArchivedFleets(organizationId);
        const filtered = query
          ? archivedFleets.filter(
              fleet =>
                fleet.name?.toLowerCase().includes(query) ||
                fleet.description?.toLowerCase().includes(query) ||
                fleet.archiveReason?.toLowerCase().includes(query)
            )
          : archivedFleets;
        for (const fleet of filtered) {
          items.push({
            id: fleet.id,
            resourceType: 'fleet',
            resourceId: fleet.id,
            name: fleet.name,
            archivedAt: fleet.archivedAt,
            archivedBy: fleet.archivedBy,
            reason: fleet.archiveReason,
          });
        }
      }

      const pageNum = Number.parseInt(page) || 1;
      const pageSize = Math.min(Number.parseInt(limit) || 20, 200);
      const start = (pageNum - 1) * pageSize;
      const paged = items.slice(start, start + pageSize);

      res.json({
        success: true,
        data: paged,
        pagination: {
          total: items.length,
          count: paged.length,
          page: pageNum,
          pageSize,
          hasMore: start + pageSize < items.length,
          totalPages: Math.ceil(items.length / pageSize),
        },
      });
    });
  };
}
