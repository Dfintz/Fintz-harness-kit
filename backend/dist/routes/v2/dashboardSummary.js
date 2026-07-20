"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const dashboardSummaryController_1 = require("../../controllers/v2/dashboardSummaryController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new dashboardSummaryController_1.DashboardSummaryController();
router.get('/summary', auth_1.authenticate, controller.getSummary.bind(controller));
//# sourceMappingURL=dashboardSummary.js.map