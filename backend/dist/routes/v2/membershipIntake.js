"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const membershipIntakeController_1 = require("../../controllers/membershipIntakeController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
let membershipIntakeController;
const getController = () => {
    if (!membershipIntakeController) {
        membershipIntakeController = new membershipIntakeController_1.MembershipIntakeController();
    }
    return membershipIntakeController;
};
router.get('/organizations/:orgId/membership/inbox', auth_1.authenticate, (req, res) => getController().getInbox(req, res));
//# sourceMappingURL=membershipIntake.js.map