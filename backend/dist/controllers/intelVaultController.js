"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelVaultController = void 0;
const IntelOfficerService_1 = require("../services/intel/IntelOfficerService");
const IntelVaultService_1 = require("../services/intel/IntelVaultService");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
class IntelVaultController extends BaseController_1.BaseController {
    intelVaultService;
    intelOfficerService;
    constructor() {
        super();
        this.intelVaultService = new IntelVaultService_1.IntelVaultService();
        this.intelOfficerService = new IntelOfficerService_1.IntelOfficerService();
    }
    checkAccess = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            return this.intelVaultService.checkAccess(user.id, orgId);
        });
    };
    createEntry = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'title',
                'content',
                'category',
                'classification',
                'tags',
                'relatedEntities',
                'expiresAt',
                'isArchived',
            ]);
            const entry = await this.intelVaultService.createEntry({
                ...safeBody,
                organizationId: orgId,
            }, user.id, ipAddress, userAgent);
            res.status(201);
            return entry;
        });
    };
    getEntries = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const { includeArchived, classification, category, search, limit, offset } = req.query;
            return this.intelVaultService.getEntries(orgId, user.id, {
                includeArchived: includeArchived === 'true',
                classification: classification,
                category: category,
                search: search,
                limit: limit ? Math.min(parseInt(limit), 200) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
        });
    };
    getEntry = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, entryId } = req.params;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            return this.intelVaultService.getEntry(entryId, user.id, orgId, ipAddress, userAgent);
        });
    };
    updateEntry = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, entryId } = req.params;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'title',
                'content',
                'classification',
                'tags',
                'metadata',
            ]);
            return this.intelVaultService.updateEntry(entryId, user.id, orgId, safeBody, ipAddress, userAgent);
        });
    };
    deleteEntry = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, entryId } = req.params;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            await this.intelVaultService.deleteEntry(entryId, user.id, orgId, ipAddress, userAgent);
            res.status(204).send();
        });
    };
    getAuditLogs = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const { intelEntryId, action, userId, startDate, endDate, limit, offset } = req.query;
            return this.intelVaultService.getAuditLogs(orgId, user.id, {
                intelEntryId: intelEntryId,
                action: action,
                userId: userId,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                limit: limit ? Math.min(parseInt(limit), 200) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
        });
    };
    appointOfficer = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'userId',
                'rank',
                'clearanceLevel',
                'specializations',
                'notes',
                'appointedAt',
            ]);
            const officer = await this.intelOfficerService.appointOfficer({
                ...safeBody,
                organizationId: orgId,
            }, user.id, ipAddress, userAgent);
            res.status(201);
            return officer;
        });
    };
    getOfficers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const { includeInactive, rank } = req.query;
            return this.intelOfficerService.getOfficers(orgId, user.id, {
                includeInactive: includeInactive === 'true',
                rank,
            });
        });
    };
    getOfficer = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, officerId } = req.params;
            return this.intelOfficerService.getOfficer(officerId, user.id, orgId);
        });
    };
    updateOfficer = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, officerId } = req.params;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, ['role', 'permissions', 'status']);
            return this.intelOfficerService.updateOfficer(officerId, user.id, orgId, safeBody, ipAddress, userAgent);
        });
    };
    removeOfficer = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, officerId } = req.params;
            const { reason } = req.body;
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.get('user-agent');
            await this.intelOfficerService.removeOfficer(officerId, user.id, orgId, reason, ipAddress, userAgent);
            res.status(204).send();
        });
    };
}
exports.IntelVaultController = IntelVaultController;
//# sourceMappingURL=intelVaultController.js.map