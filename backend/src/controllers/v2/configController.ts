import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { OrganizationSettings } from '../../models/Organization';
import { OrganizationSettingsService } from '../../services/organization/OrganizationSettingsService';
import { BaseController } from '../BaseController';

/**
 * Organization Configuration Controller (v2)
 *
 * Manages org-level key-value configuration settings.
 * Delegates to OrganizationSettingsService for all CRUD, validation,
 * and inheritance operations.
 */
export class ConfigController extends BaseController {
  private readonly settingsService: OrganizationSettingsService;

  constructor() {
    super();
    this.settingsService = new OrganizationSettingsService();
  }

  getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const scope = req.query.scope as string | undefined;

      const settings =
        scope === 'effective'
          ? await this.settingsService.getEffectiveSettings(organizationId)
          : await this.settingsService.getSettings(organizationId);

      res.json({
        success: true,
        data: {
          organizationId,
          scope: scope ?? 'org',
          settings: settings ?? {},
        },
      });
    });
  };

  updateAll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { settings } = req.body as { settings: Partial<OrganizationSettings> };

      const updated = await this.settingsService.updateSettings(organizationId, settings, true);

      res.json({
        success: true,
        data: {
          organizationId,
          updatedKeys: Object.keys(settings),
          settings: updated,
        },
      });
    });
  };

  getByKey = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { key } = req.params;

      const value = await this.settingsService.getSetting(
        organizationId,
        key as keyof OrganizationSettings
      );

      res.json({
        success: true,
        data: {
          organizationId,
          key,
          value: value ?? null,
        },
      });
    });
  };

  updateByKey = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { key } = req.params;
      const { value } = req.body as { value: unknown };

      const settingKey = key as keyof OrganizationSettings;
      const updated = await this.settingsService.updateSetting(
        organizationId,
        settingKey,
        value as OrganizationSettings[typeof settingKey]
      );

      res.json({
        success: true,
        data: {
          organizationId,
          key,
          value: updated[key as keyof OrganizationSettings],
          settings: updated,
        },
      });
    });
  };

  deleteByKey = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { key } = req.params;

      await this.settingsService.deleteSetting(organizationId, key as keyof OrganizationSettings);

      res.json({
        success: true,
        message: `Config key '${key}' reset to default`,
      });
    });
  };

  importConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { settings, overwrite } = req.body as {
        settings: Partial<OrganizationSettings>;
        overwrite?: boolean;
      };

      // overwrite=true → merge=false (replace), overwrite=false → merge=true (merge)
      const updated = await this.settingsService.updateSettings(
        organizationId,
        settings,
        !overwrite
      );

      res.json({
        success: true,
        data: {
          organizationId,
          importedKeys: Object.keys(settings),
          overwrite: overwrite ?? false,
          settings: updated,
        },
      });
    });
  };

  exportConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const scope = req.query.scope as string | undefined;

      const settings =
        scope === 'effective'
          ? await this.settingsService.getEffectiveSettings(organizationId)
          : await this.settingsService.getSettings(organizationId);

      res.json({
        success: true,
        data: {
          organizationId,
          scope: scope ?? 'org',
          settings: settings ?? {},
          exportedAt: new Date().toISOString(),
        },
      });
    });
  };

  getSchema = async (_req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(_req, res, async () => {
      res.json({
        success: true,
        data: {
          schema: {
            visibility: {
              type: 'enum',
              values: ['public', 'private', 'restricted'],
              default: 'private',
            },
            allowSubOrgs: { type: 'boolean', default: true },
            maxDepth: { type: 'number', default: 5, min: 1, max: 10 },
            requireApproval: { type: 'boolean', default: false },
            inheritPermissions: { type: 'boolean', default: true },
            enableTeams: { type: 'boolean', default: false },
            customFields: { type: 'object', default: {} },
            ipWhitelist: { type: 'object', description: 'IP whitelist settings' },
            gdpr: { type: 'object', description: 'GDPR compliance settings' },
          },
        },
      });
    });
  };
}
