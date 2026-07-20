"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const eventAttendanceController_1 = require("../../controllers/v2/eventAttendanceController");
const auth_1 = require("../../middleware/auth");
const tenantContext_1 = require("../../middleware/tenantContext");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new eventAttendanceController_1.EventAttendanceControllerV2();
const orgScoped = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.post('/activities/:id/attend', [...orgScoped], controller.recordAttendance.bind(controller));
router.get('/activities/:id/attendance', [...orgScoped], controller.getAttendanceRecords.bind(controller));
router.put('/activities/:id/attendance/:userId', [...orgScoped], controller.updateAttendanceStatus.bind(controller));
router.get('/activities/:id/attendance/stats', [...orgScoped], controller.getAttendanceStats.bind(controller));
router.get('/activities/:id/attendance/correlation', [...orgScoped], controller.getAttendanceCorrelationSummary.bind(controller));
router.get('/users/:userId/attendance', [...orgScoped], controller.getUserAttendanceHistory.bind(controller));
//# sourceMappingURL=eventAttendance.js.map