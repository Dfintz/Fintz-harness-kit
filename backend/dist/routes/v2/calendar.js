"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const calendarController_1 = require("../../controllers/v2/calendarController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new calendarController_1.CalendarControllerV2();
router.get('/events', auth_1.authenticate, controller.getEvents.bind(controller));
router.get('/events/:eventId', auth_1.authenticate, controller.getEventById.bind(controller));
router.get('/events/:eventId/ics', auth_1.authenticate, controller.downloadEventICS.bind(controller));
router.get('/export/org/:orgId', auth_1.authenticate, controller.exportOrgCalendar.bind(controller));
router.get('/export/user', auth_1.authenticate, controller.exportUserCalendar.bind(controller));
//# sourceMappingURL=calendar.js.map