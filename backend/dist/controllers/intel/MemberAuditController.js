"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberAuditController = void 0;
const MemberAuditService_1 = require("../../services/intel/MemberAuditService");
const BaseController_1 = require("../BaseController");
class MemberAuditController extends BaseController_1.BaseController {
    auditService = null;
    getService() {
        this.auditService ??= new MemberAuditService_1.MemberAuditService();
        return this.auditService;
    }
    listFlags = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            const query = req.query;
            if (query.flagTypes && !Array.isArray(query.flagTypes)) {
                query.flagTypes = [query.flagTypes];
            }
            if (query.severities && !Array.isArray(query.severities)) {
                query.severities = [query.severities];
            }
            if (query.statuses && !Array.isArray(query.statuses)) {
                query.statuses = [query.statuses];
            }
            return this.getService().listFlags(orgId, query);
        });
    };
    getFlagById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, flagId } = req.params;
            const flag = await this.getService().getFlagById(orgId, flagId);
            if (!flag) {
                res.status(404).json({ error: 'Flag not found' });
                return null;
            }
            return flag;
        });
    };
    createManualFlag = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const dto = req.body;
            const flag = await this.getService().createManualFlag(orgId, dto.userId, user.id, dto);
            return this.getService().toSummary(flag);
        }, 201);
    };
    resolveFlag = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId, flagId } = req.params;
            const dto = req.body;
            const flag = await this.getService().resolveFlag(orgId, flagId, user.id, dto);
            return this.getService().toSummary(flag);
        });
    };
    getUserFlagStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, userId } = req.params;
            return this.getService().getUserFlagStats(orgId, userId);
        });
    };
}
exports.MemberAuditController = MemberAuditController;
//# sourceMappingURL=MemberAuditController.js.map