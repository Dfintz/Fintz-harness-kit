"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigController = void 0;
const OrganizationSettingsService_1 = require("../../services/organization/OrganizationSettingsService");
const BaseController_1 = require("../BaseController");
class ConfigController extends BaseController_1.BaseController {
    settingsService;
    constructor() {
        super();
        this.settingsService = new OrganizationSettingsService_1.OrganizationSettingsService();
    }
    getAll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const scope = req.query.scope;
            const settings = scope === 'effective'
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
    updateAll = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { settings } = req.body;
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
    getByKey = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { key } = req.params;
            const value = await this.settingsService.getSetting(organizationId, key);
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
    updateByKey = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { key } = req.params;
            const { value } = req.body;
            const settingKey = key;
            const updated = await this.settingsService.updateSetting(organizationId, settingKey, value);
            res.json({
                success: true,
                data: {
                    organizationId,
                    key,
                    value: updated[key],
                    settings: updated,
                },
            });
        });
    };
    deleteByKey = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { key } = req.params;
            await this.settingsService.deleteSetting(organizationId, key);
            res.json({
                success: true,
                message: `Config key '${key}' reset to default`,
            });
        });
    };
    importConfig = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { settings, overwrite } = req.body;
            const updated = await this.settingsService.updateSettings(organizationId, settings, !overwrite);
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
    exportConfig = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const scope = req.query.scope;
            const settings = scope === 'effective'
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
    getSchema = async (_req, res) => {
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
exports.ConfigController = ConfigController;
//# sourceMappingURL=configController.js.map