"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllianceDiplomacyController = void 0;
const AllianceDiplomacyService_1 = require("../services/organization/AllianceDiplomacyService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class AllianceDiplomacyController extends BaseController_1.BaseController {
    diplomacyService = new AllianceDiplomacyService_1.AllianceDiplomacyService();
    constructor() {
        super();
    }
    getOrgContext(req) {
        const userId = req.user?.id;
        const orgId = req.user?.currentOrganizationId;
        if (!userId || !orgId) {
            throw new apiErrors_1.BadRequestError('Organization context is required');
        }
        return { userId, orgId };
    }
    proposeDiplomacy = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId, orgId } = this.getOrgContext(req);
            const { targetOrgId, allianceType, notes } = req.body;
            return this.diplomacyService.propose({
                orgId1: orgId,
                orgId2: targetOrgId,
                allianceType,
                proposedBy: userId,
                notes,
            });
        }, 201);
    };
    getDiplomacyRelations = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.diplomacyService.findAll(orgId, paginationOptions);
        });
    };
    getDiplomacyById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.diplomacyService.findById(req.params.id, orgId);
        });
    };
    approveDiplomacy = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId, orgId } = this.getOrgContext(req);
            return this.diplomacyService.approve(req.params.id, orgId, userId);
        });
    };
    suspendDiplomacy = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.diplomacyService.suspend(req.params.id, orgId);
        });
    };
    terminateDiplomacy = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.diplomacyService.terminate(req.params.id, orgId);
        });
    };
    reportIncident = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId, orgId } = this.getOrgContext(req);
            const reportedBy = req.body.reportedBy ?? userId;
            return this.diplomacyService.reportIncident(req.params.id, orgId, {
                description: req.body.description,
                severity: req.body.severity,
                reportedBy,
            });
        });
    };
    resolveIncident = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.diplomacyService.resolveIncident(req.params.id, orgId, req.params.incidentId);
        });
    };
}
exports.AllianceDiplomacyController = AllianceDiplomacyController;
//# sourceMappingURL=allianceDiplomacyController.js.map