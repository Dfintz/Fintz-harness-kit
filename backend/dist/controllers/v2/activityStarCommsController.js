"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityStarCommsController = void 0;
const ActivityStarCommsOrchestrationService_1 = require("../../services/activity/ActivityStarCommsOrchestrationService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class ActivityStarCommsController extends BaseController_1.BaseController {
    orchestrationService = new ActivityStarCommsOrchestrationService_1.ActivityStarCommsOrchestrationService();
    provisionFromActivity = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const activityId = this.requireUuid(req.params.activityId, 'activityId');
            const integrationId = this.requireUuid(String(req.body.integrationId), 'integrationId');
            const dryRun = Boolean(req.body.dryRun);
            const user = req.user;
            if (!user?.id || !user.username) {
                throw new apiErrors_1.ForbiddenError('Authentication required');
            }
            if (!user.currentOrganizationId) {
                throw new apiErrors_1.ForbiddenError('Organization context is required for activity operations');
            }
            return this.orchestrationService.provisionFromActivity({
                activityId,
                integrationId,
                dryRun,
                userId: user.id,
                userName: user.username,
                organizationId: user.currentOrganizationId,
            });
        }, 200);
    };
    requireUuid(value, fieldName) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!value || !uuidRegex.test(value)) {
            throw new apiErrors_1.ValidationError(`Invalid ${fieldName}`);
        }
        return value;
    }
}
exports.ActivityStarCommsController = ActivityStarCommsController;
//# sourceMappingURL=activityStarCommsController.js.map