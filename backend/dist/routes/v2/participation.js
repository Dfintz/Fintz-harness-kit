"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const participationController_1 = require("../../controllers/v2/participationController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new participationController_1.ParticipationControllerV2();
router.use(auth_1.authenticate);
router.get('/summary', controller.getSummary.bind(controller));
router.get('/users/:userId/summary', controller.getUserSummary.bind(controller));
//# sourceMappingURL=participation.js.map