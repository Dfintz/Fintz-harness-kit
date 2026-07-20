"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const eventWaitlistController_1 = require("../../controllers/v2/eventWaitlistController");
const auth_1 = require("../../middleware/auth");
const tenantContext_1 = require("../../middleware/tenantContext");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new eventWaitlistController_1.EventWaitlistControllerV2();
const orgScoped = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.post('/activities/:id/waitlist', [...orgScoped], controller.joinWaitlist.bind(controller));
router.delete('/activities/:id/waitlist', [...orgScoped], controller.leaveWaitlist.bind(controller));
router.get('/activities/:id/waitlist', [...orgScoped], controller.getWaitlist.bind(controller));
router.post('/activities/:id/waitlist/promote', [...orgScoped], controller.promoteFromWaitlist.bind(controller));
//# sourceMappingURL=eventWaitlist.js.map