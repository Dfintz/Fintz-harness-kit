"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReputationController = void 0;
const FleetReputationService_1 = require("../services/fleet/FleetReputationService");
const ReputationService_1 = require("../services/social/ReputationService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class ReputationController extends BaseController_1.BaseController {
    reputationService = new ReputationService_1.ReputationService();
    fleetReputationService = FleetReputationService_1.FleetReputationService.getInstance();
    constructor() {
        super();
    }
    getUserReputation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.reputationService.getOrCreateReputation(req.params.userId));
    };
    updateReputation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId } = req.params;
            const { category, amount, reason, modifiedBy } = req.body;
            return this.reputationService.updateScore(userId, category, amount, reason, modifiedBy);
        });
    };
    getTopReputation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { category } = req.query;
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.reputationService.getLeaderboard(paginationOptions, category);
        });
    };
    getUnifiedReputation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId } = req.params;
            const organizationId = req.query.organizationId;
            return this.reputationService.getUnifiedReputation(userId, organizationId);
        });
    };
    getFleetReputation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            const organizationId = req.query.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('organizationId query parameter is required');
            }
            return this.fleetReputationService.getFleetReputation(organizationId, fleetId);
        });
    };
}
exports.ReputationController = ReputationController;
//# sourceMappingURL=reputationController.js.map