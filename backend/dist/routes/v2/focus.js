"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const focusController_1 = require("../../controllers/v2/focusController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new focusController_1.FocusControllerV2();
router.get('/focuses', auth_1.authenticate, controller.getFocusList.bind(controller));
router.put('/users/me/focuses', auth_1.authenticate, controller.setUserFocus.bind(controller));
router.get('/users/me/focuses', auth_1.authenticate, controller.getUserFocus.bind(controller));
router.put('/organizations/:orgId/focuses', auth_1.authenticate, controller.setOrgFocus.bind(controller));
router.get('/organizations/:orgId/focuses', auth_1.authenticate, controller.getOrgFocus.bind(controller));
//# sourceMappingURL=focus.js.map