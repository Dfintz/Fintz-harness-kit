"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAttendanceRoutes = setAttendanceRoutes;
const express_1 = require("express");
const database_1 = require("../config/database");
const attendanceController_1 = require("../controllers/attendanceController");
const auth_1 = require("../middleware/auth");
const crossTenantAccess_1 = require("../middleware/crossTenantAccess");
const schemaValidation_1 = require("../middleware/schemaValidation");
const tenantContext_1 = require("../middleware/tenantContext");
const EventAttendanceConfirmation_1 = require("../models/EventAttendanceConfirmation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let attendanceController;
const getController = () => {
    if (!attendanceController) {
        attendanceController = new attendanceController_1.AttendanceController();
    }
    return attendanceController;
};
const authStack = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.post('/activities/:activityId/attendance/initialize', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.attendanceSchemas.initialize, 'body'), (req, res) => getController().initializeAttendance(req, res));
router.post('/activities/:activityId/attendance/confirm', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.attendanceSchemas.confirm, 'body'), (req, res) => getController().confirmAttendance(req, res));
router.post('/activities/:activityId/attendance/record', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.attendanceSchemas.record, 'body'), (req, res) => getController().recordAttendance(req, res));
router.post('/activities/:activityId/attendance/no-show', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.attendanceSchemas.noShow, 'body'), (req, res) => getController().markNoShow(req, res));
router.post('/activities/:activityId/attendance/send-requests', ...authStack, (req, res) => getController().sendConfirmationRequests(req, res));
router.get('/activities/:activityId/attendance/stats', ...authStack, (req, res) => getController().getAttendanceStats(req, res));
router.get('/activities/:activityId/attendance/report', ...authStack, (req, res) => getController().getAttendanceReport(req, res));
router.get('/users/:userId/attendance/history', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.userId, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.attendanceSchemas.historyQuery, 'query'), (req, res) => getController().getUserHistory(req, res));
router.get('/organizations/:organizationId/attendance/leaderboard', ...authStack, (req, res) => getController().getLeaderboard(req, res));
router.post('/attendance/:confirmationId/rating', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.attendanceSchemas.rating, 'body'), (0, crossTenantAccess_1.validateCrossTenantAccess)({
    resourceType: 'attendance_confirmation',
    action: 'write',
    getResourceOrgId: async (req) => {
        const confirmationRepo = database_1.AppDataSource.getRepository(EventAttendanceConfirmation_1.EventAttendanceConfirmation);
        const confirmation = await confirmationRepo.findOne({
            where: { id: req.params.confirmationId },
        });
        return confirmation?.organizationId || null;
    },
    requireSharing: false,
    allowSameOrg: true,
}), (req, res) => getController().addRating(req, res));
function setAttendanceRoutes(app) {
    app.use('/api', router);
}
//# sourceMappingURL=attendanceRoutes.js.map