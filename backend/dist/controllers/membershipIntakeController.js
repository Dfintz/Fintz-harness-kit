"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipIntakeController = void 0;
const MembershipIntakeService_1 = require("../services/organization/MembershipIntakeService");
const BaseController_1 = require("./BaseController");
class MembershipIntakeController extends BaseController_1.BaseController {
    service = new MembershipIntakeService_1.MembershipIntakeService();
    getInbox = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const inbox = await this.service.getInbox(user.id, orgId);
            return { success: true, data: inbox };
        });
    };
}
exports.MembershipIntakeController = MembershipIntakeController;
//# sourceMappingURL=membershipIntakeController.js.map