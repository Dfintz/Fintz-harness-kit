"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const activityController_1 = require("../../controllers/v2/activityController");
const eventAttendanceController_1 = require("../../controllers/v2/eventAttendanceController");
const eventConflictController_1 = require("../../controllers/v2/eventConflictController");
const recurringActivityController_1 = require("../../controllers/v2/recurringActivityController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const activitySchemas_1 = require("../../schemas/activitySchemas");
const router = (0, express_1.Router)();
exports.router = router;
const activityController = new activityController_1.ActivityControllerV2();
const recurringController = new recurringActivityController_1.RecurringActivityControllerV2();
const attendanceController = new eventAttendanceController_1.EventAttendanceControllerV2();
const conflictController = new eventConflictController_1.EventConflictControllerV2();
router.post('/', auth_1.authenticate, (req, _res, next) => {
    req.body.type = 'event';
    if (req.body.date && !req.body.startDate) {
        req.body.startDate = req.body.date;
    }
    if (req.body.duration !== undefined && req.body.duration !== null) {
        req.body.estimatedDuration = req.body.duration;
    }
    if (req.body.recurrence) {
        req.body.metadata = {
            ...req.body.metadata,
            recurrencePattern: req.body.recurrence,
            recurrenceEndDate: req.body.recurrenceEndDate ?? undefined,
        };
    }
    next();
}, (0, schemaValidation_1.validateSchema)(activitySchemas_1.activitySchemas.createV2), activityController.createActivity.bind(activityController));
router.get('/', auth_1.authenticate, activityController.getMyActivities.bind(activityController));
router.get('/:id', auth_1.authenticate, activityController.getActivityById.bind(activityController));
router.put('/:id', auth_1.authenticate, (req, _res, next) => {
    if (req.body.date && !req.body.startDate) {
        req.body.startDate = req.body.date;
    }
    if (req.body.duration !== undefined && req.body.duration !== null) {
        req.body.estimatedDuration = req.body.duration;
    }
    if (req.body.recurrence !== undefined) {
        req.body.metadata = {
            ...req.body.metadata,
            recurrencePattern: req.body.recurrence,
            recurrenceEndDate: req.body.recurrenceEndDate ?? undefined,
        };
    }
    next();
}, (0, schemaValidation_1.validateSchema)(activitySchemas_1.activitySchemas.updateV2), activityController.updateActivity.bind(activityController));
router.delete('/:id', auth_1.authenticate, activityController.deleteActivity.bind(activityController));
router.post('/:id/attendees', auth_1.authenticate, activityController.joinActivity.bind(activityController));
router.delete('/:id/attendees', auth_1.authenticate, activityController.leaveActivity.bind(activityController));
router.post('/:id/attend', auth_1.authenticate, attendanceController.recordAttendance.bind(attendanceController));
router.get('/:id/attendance', auth_1.authenticate, attendanceController.getAttendanceRecords.bind(attendanceController));
router.put('/:id/attendance/:userId', auth_1.authenticate, attendanceController.updateAttendanceStatus.bind(attendanceController));
router.get('/:id/attendance/stats', auth_1.authenticate, attendanceController.getAttendanceStats.bind(attendanceController));
router.get('/users/:userId/attendance', auth_1.authenticate, attendanceController.getUserAttendanceHistory.bind(attendanceController));
router.post('/recurring', auth_1.authenticate, (req, _res, next) => {
    req.body.activityType = 'EVENT';
    next();
}, recurringController.createRecurringInstances.bind(recurringController));
router.get('/recurring/:seriesId', auth_1.authenticate, recurringController.previewRecurringActivity.bind(recurringController));
router.get('/conflicts/check', auth_1.authenticate, conflictController.checkConflicts.bind(conflictController));
router.get('/conflicts/me', auth_1.authenticate, conflictController.getMyConflicts.bind(conflictController));
router.get('/conflicts/activity/:activityId', auth_1.authenticate, conflictController.getActivityConflicts.bind(conflictController));
router.get('/conflicts/user/:userId', auth_1.authenticate, conflictController.getUserConflicts.bind(conflictController));
router.get('/conflicts/range', auth_1.authenticate, conflictController.getConflictsInRange.bind(conflictController));
router.get('/upcoming', auth_1.authenticate, activityController.getUpcomingActivities.bind(activityController));
router.get('/recommended', auth_1.authenticate, activityController.getRecommendedActivities.bind(activityController));
//# sourceMappingURL=events.js.map