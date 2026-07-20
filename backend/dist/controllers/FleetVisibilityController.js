"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetVisibilityController = void 0;
const FleetVisibilityService_1 = require("../services/fleet/FleetVisibilityService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class FleetVisibilityController extends BaseController_1.BaseController {
    visibilityService = new FleetVisibilityService_1.FleetVisibilityService();
    constructor() {
        super();
    }
    getOrgContext(req) {
        const userId = req.user?.id;
        const orgId = req.tenantContext?.organizationId ?? req.user?.currentOrganizationId;
        if (!userId || !orgId) {
            throw new apiErrors_1.BadRequestError('Organization context is required');
        }
        return { userId, orgId };
    }
    getRules = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            const fleetId = req.params.id;
            return this.visibilityService.getRulesForFleet(orgId, fleetId);
        });
    };
    createRule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            const fleetId = req.params.id;
            return this.visibilityService.createRule(orgId, fleetId, req.body);
        }, 201);
    };
    updateRule = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.visibilityService.updateRule(orgId, req.params.ruleId, req.body);
        });
    };
    deleteRule = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            await this.visibilityService.deleteRule(orgId, req.params.ruleId);
            res.status(204).send();
        });
    };
    checkAccess = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId, orgId } = this.getOrgContext(req);
            const fleetId = req.params.id;
            const { targetOrgId } = req.body;
            const securityLevel = await this.visibilityService.getUserSecurityLevel(userId, targetOrgId ?? orgId);
            const accessLevel = await this.visibilityService.resolveAccessLevel(targetOrgId ?? orgId, orgId, fleetId, securityLevel);
            return { fleetId, accessLevel };
        });
    };
}
exports.FleetVisibilityController = FleetVisibilityController;
//# sourceMappingURL=FleetVisibilityController.js.map