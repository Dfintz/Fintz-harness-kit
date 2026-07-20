"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationStatusController = void 0;
const IntegrationStatusService_1 = require("../../services/monitoring/IntegrationStatusService");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const BaseController_1 = require("../BaseController");
class IntegrationStatusController extends BaseController_1.BaseController {
    integrationStatusService;
    constructor() {
        super();
        this.integrationStatusService = IntegrationStatusService_1.IntegrationStatusService.getInstance();
    }
    getSystemHealth = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            logger_1.logger.info('Integration health dashboard requested', { userId: user.id });
            return this.integrationStatusService.getSystemHealth();
        });
    };
    getIntegrationHealth = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const user = this.getAuthUser(authReq);
            const { name } = authReq.params;
            logger_1.logger.info('Specific integration health requested', { userId: user.id, integration: name });
            const health = await this.integrationStatusService.getIntegrationHealth(name);
            if (!health) {
                throw new apiErrors_1.NotFoundError('Integration', name);
            }
            return health;
        });
    };
    refreshHealth = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            logger_1.logger.info('Integration health refresh triggered', { userId: user.id });
            return this.integrationStatusService.refreshHealth();
        });
    };
}
exports.IntegrationStatusController = IntegrationStatusController;
//# sourceMappingURL=integrationStatusController.js.map