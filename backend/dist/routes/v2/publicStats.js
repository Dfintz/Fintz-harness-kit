"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const publicStatsController_1 = require("../../controllers/v2/publicStatsController");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new publicStatsController_1.PublicStatsController();
router.get('/public/stats', rateLimiting_1.generalRateLimiter, (req, res) => controller.getPublicStats(req, res));
//# sourceMappingURL=publicStats.js.map