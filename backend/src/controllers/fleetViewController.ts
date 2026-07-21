import { Response } from 'express';
import multer from 'multer';

import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { Organization } from '../models/Organization';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { FleetViewService } from '../services/fleet/FleetViewService';
import {
  FleetViewExportOptions,
  FleetViewImportOptions,
  FleetViewSchema,
} from '../types/fleetview';
import { UnauthorizedError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';
import { getRoleName } from '../utils/roleUtils';

import { BaseController } from './BaseController';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  },
});

/**
 * Controller for FleetView import/export operations
 * Allows users and org leads to import/export ship lists in FleetView format
 */
export class FleetViewController extends BaseController {
  private readonly fleetViewService = new FleetViewService();
  private readonly organizationRepository = AppDataSource.getRepository(Organization);
  private readonly userOrganizationRepository = AppDataSource.getRepository(OrganizationMembership);

  private static readonly IMPORT_OPTION_FIELDS = new Set(['merge', 'skipDuplicates']);

  // Multer middleware for file uploads
  public uploadMiddleware = upload.single('file');

  /**
   * Normalizes FleetView payload shapes so imports accept both raw arrays and wrapped objects.
   */
  private normalizeFleetViewSchema(rawSchema: unknown): FleetViewSchema {
    let parsedSchema = rawSchema;

    if (typeof parsedSchema === 'string') {
      try {
        parsedSchema = JSON.parse(parsedSchema) as unknown;
      } catch (parseError) {
        throw new ValidationError('Invalid JSON schema format', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    }

    if (Array.isArray(parsedSchema)) {
      return { ships: parsedSchema as FleetViewSchema['ships'] };
    }

    if (parsedSchema && typeof parsedSchema === 'object') {
      const schemaObject = parsedSchema as Record<string, unknown>;
      if (Array.isArray(schemaObject.ships)) {
        return parsedSchema as FleetViewSchema;
      }
    }

    throw new ValidationError(
      'Invalid FleetView schema format. JSON must be an array of ships or an object with a "ships" array.'
    );
  }

  private hasDirectSchemaInBody(body: unknown): boolean {
    if (!body || typeof body !== 'object') {
      return false;
    }

    const bodyObject = body as Record<string, unknown>;
    return Object.keys(bodyObject).some(key => !FleetViewController.IMPORT_OPTION_FIELDS.has(key));
  }

  /**
   * Helper method to parse FleetView schema from request
   * Handles both file uploads and JSON body
   * @throws ValidationError if JSON is invalid
   */
  private parseFleetViewSchema(req: AuthRequest): FleetViewSchema {
    let rawSchema: unknown;

    if (req.file) {
      // Parse JSON from uploaded file
      const fileContent = req.file.buffer.toString('utf-8');
      try {
        rawSchema = JSON.parse(fileContent) as unknown;
      } catch (parseError) {
        // NOSONAR: S2486 — re-throwing as domain-specific ValidationError
        throw new ValidationError('Invalid JSON file format', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });
      }
    } else if (req.body?.schema !== undefined) {
      // Direct JSON in request body
      rawSchema = req.body.schema;
    } else if (this.hasDirectSchemaInBody(req.body)) {
      rawSchema = req.body;
    } else {
      throw new ValidationError(
        'No FleetView data provided. Send either a JSON file or schema in request body.'
      );
    }

    return this.normalizeFleetViewSchema(rawSchema);
  }

  /**
   * Export user's personal fleet to FleetView format
   * GET /api/fleet/export/user
   */
  exportUserFleet = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const includeStatistics = req.query.includeStatistics !== 'false';
      const includeInactive = parseBooleanQuery(req.query.includeInactive);

      const options: FleetViewExportOptions = {
        userId,
        includeStatistics,
        includeInactive,
      };

      const schema = await this.fleetViewService.exportToFleetView(options);

      // Set download headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="my-fleet-${Date.now()}.json"`);

      return schema;
    });
  };

  /**
   * Export organization fleet to FleetView format (org leads only)
   * GET /api/fleet/export/org/:organizationId
   */
  exportOrgFleet = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const { organizationId } = req.params;

      // Verify user is org lead or admin
      const userOrg = await this.userOrganizationRepository.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (
        !userOrg ||
        (getRoleName(userOrg.role) !== 'admin' &&
          getRoleName(userOrg.role) !== 'owner' &&
          getRoleName(userOrg.role) !== 'founder')
      ) {
        throw new UnauthorizedError(
          'Unauthorized: Only organization leaders can export organization fleets'
        );
      }

      const includeStatistics = req.query.includeStatistics !== 'false';
      const includeInactive = parseBooleanQuery(req.query.includeInactive);

      const options: FleetViewExportOptions = {
        organizationId,
        includeStatistics,
        includeInactive,
      };

      const schema = await this.fleetViewService.exportToFleetView(options);

      // Get org name for filename
      const org = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });
      const orgName = org?.name.replaceAll(/[^a-z0-9]/gi, '-').toLowerCase() || organizationId;

      // Set download headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${orgName}-fleet-${Date.now()}.json"`
      );

      return schema;
    });
  };

  /**
   * Import ships to user's personal fleet from FleetView format
   * POST /api/fleet/import/user
   */
  importUserFleet = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const schema = this.parseFleetViewSchema(req);

      // Validate schema
      if (!this.fleetViewService.validateSchema(schema)) {
        throw new ValidationError('Invalid FleetView schema format');
      }

      // Use user's default organization
      const organizationId = `user-${userId}`;

      const options: FleetViewImportOptions = {
        merge: req.body.merge !== false,
        skipDuplicates: req.body.skipDuplicates !== false,
        organizationId,
        userId,
      };

      const result = await this.fleetViewService.importFromFleetView(schema, options);

      return result;
    });
  };

  /**
   * Import ships to organization fleet from FleetView format (org leads only)
   * POST /api/fleet/import/org/:organizationId
   */
  importOrgFleet = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('User not authenticated');
      }

      const { organizationId } = req.params;

      // Verify user is org lead or admin
      const userOrg = await this.userOrganizationRepository.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (
        !userOrg ||
        (getRoleName(userOrg.role) !== 'admin' &&
          getRoleName(userOrg.role) !== 'owner' &&
          getRoleName(userOrg.role) !== 'founder')
      ) {
        throw new UnauthorizedError(
          'Unauthorized: Only organization leaders can import to organization fleets'
        );
      }

      const schema = this.parseFleetViewSchema(req);

      // Validate schema
      if (!this.fleetViewService.validateSchema(schema)) {
        throw new ValidationError('Invalid FleetView schema format');
      }

      if (!organizationId) {
        throw new ValidationError('Organization ID is required');
      }

      const options: FleetViewImportOptions = {
        merge: req.body.merge !== false,
        skipDuplicates: req.body.skipDuplicates !== false,
        organizationId,
        userId,
      };

      const result = await this.fleetViewService.importFromFleetView(schema, options);

      return result;
    });
  };

  /**
   * Validate FleetView schema without importing
   * POST /api/fleet/validate
   */
  validateSchema = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      let rawSchema: unknown;

      // Check if this is a file upload or JSON body
      if (req.file) {
        const fileContent = req.file.buffer.toString('utf-8');
        try {
          rawSchema = JSON.parse(fileContent) as unknown;
        } catch (parseError) {
          logger.warn('FleetView validation failed due to invalid JSON payload', {
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
          });

          // NOSONAR: S2486 — returning structured validation error response
          return {
            valid: false,
            error: 'Invalid JSON format',
          };
        }
      } else {
        rawSchema = req.body?.schema ?? req.body;
      }

      let schema: FleetViewSchema;
      try {
        schema = this.normalizeFleetViewSchema(rawSchema);
      } catch (parseError) {
        logger.warn('FleetView validation failed due to invalid schema format', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
        });

        return {
          valid: false,
          error: 'Invalid FleetView schema format',
        };
      }

      const isValid = this.fleetViewService.validateSchema(schema);

      if (!isValid) {
        return {
          valid: false,
          error: 'Invalid FleetView schema format',
        };
      }

      return {
        valid: true,
        shipCount: schema.ships.length,
        message: 'Schema is valid and ready for import',
      };
    });
  };
}
