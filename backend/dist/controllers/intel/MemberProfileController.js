"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberProfileController = void 0;
const MemberProfileService_1 = require("../../services/intel/MemberProfileService");
const BaseController_1 = require("../BaseController");
class MemberProfileController extends BaseController_1.BaseController {
    profileService = null;
    getService() {
        this.profileService ??= new MemberProfileService_1.MemberProfileService();
        return this.profileService;
    }
    getProfile = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, userId } = req.params;
            const viewerId = req.user?.id;
            const isPlatformAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
            return this.getService().getProfile(orgId, userId, viewerId, isPlatformAdmin);
        });
    };
}
exports.MemberProfileController = MemberProfileController;
//# sourceMappingURL=MemberProfileController.js.map