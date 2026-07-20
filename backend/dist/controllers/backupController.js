"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const BackupService_1 = require("../services/backup/BackupService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
function isUserOrgAdmin(user) {
    return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}
function parsePagination(query, defaults) {
    const MAX_LIMIT = 100;
    const defaultPage = defaults?.page ?? 1;
    const defaultLimit = defaults?.limit ?? 20;
    const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
    const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
    const parsedPage = typeof rawPage === 'string' ? Number.parseInt(rawPage, 10) : Number.NaN;
    const parsedLimit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
    let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
    if (limit > MAX_LIMIT) {
        limit = MAX_LIMIT;
    }
    return { page, limit };
}
class BackupController extends BaseController_1.BaseController {
    backupService;
    constructor() {
        super();
        this.backupService = new BackupService_1.BackupService();
    }
    getStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const status = await this.backupService.getBackupStatus(organizationId);
            res.success(status);
        });
    };
    createBackup = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const dto = req.body;
            const userId = req.user?.id ?? 'unknown';
            const userName = req.user?.username ?? 'Unknown User';
            const backup = await this.backupService.createBackup(organizationId, userId, userName, dto);
            res.status(201).json({ success: true, data: backup });
        });
    };
    listBackups = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const { page, limit } = parsePagination(req.query);
            const filters = {};
            if (req.query.status) {
                filters.status = req.query.status;
            }
            if (req.query.backupType) {
                filters.backupType = req.query.backupType;
            }
            if (req.query.sortBy) {
                filters.sortBy = req.query.sortBy;
            }
            if (req.query.sortOrder) {
                filters.sortOrder = req.query.sortOrder;
            }
            const result = await this.backupService.listBackups(organizationId, filters, { page, limit });
            res.success(result);
        });
    };
    downloadBackup = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const { backupId } = req.params;
            if (!backupId) {
                throw new apiErrors_1.ValidationError('Backup ID is required');
            }
            const url = await this.backupService.getDownloadUrl(organizationId, backupId);
            if (!url) {
                throw new apiErrors_1.NotFoundError('Backup not found or download unavailable');
            }
            res.success({ downloadUrl: url });
        });
    };
    restoreBackup = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const { backupId } = req.params;
            if (!backupId) {
                throw new apiErrors_1.ValidationError('Backup ID is required');
            }
            const userId = req.user?.id ?? 'unknown';
            const userName = req.user?.username ?? 'Unknown User';
            const result = await this.backupService.restoreFromBackup(organizationId, backupId, userId, userName);
            res.success(result);
        });
    };
    deleteBackup = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const { backupId } = req.params;
            if (!backupId) {
                throw new apiErrors_1.ValidationError('Backup ID is required');
            }
            const userId = req.user?.id ?? 'unknown';
            const userName = req.user?.username ?? 'Unknown User';
            await this.backupService.deleteBackup(organizationId, backupId, userId, userName);
            res.success({ message: 'Backup deleted successfully' });
        });
    };
    configureSchedule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const dto = req.body;
            const userId = req.user?.id ?? 'unknown';
            const userName = req.user?.username ?? 'Unknown User';
            const schedule = await this.backupService.configureSchedule(organizationId, userId, userName, dto);
            res.success(schedule);
        });
    };
    getSchedule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const schedule = await this.backupService.getSchedule(organizationId);
            res.success(schedule);
        });
    };
    updateSchedule = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            const dto = req.body;
            const userId = req.user?.id ?? 'unknown';
            const userName = req.user?.username ?? 'Unknown User';
            const schedule = await this.backupService.configureSchedule(organizationId, userId, userName, dto);
            res.success(schedule);
        });
    };
}
exports.BackupController = BackupController;
//# sourceMappingURL=backupController.js.map