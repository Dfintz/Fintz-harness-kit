"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const recurringActivityController_1 = require("../../controllers/v2/recurringActivityController");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
exports.router = router;
let recurringActivityController;
const getController = () => {
    if (!recurringActivityController) {
        recurringActivityController = new recurringActivityController_1.RecurringActivityControllerV2();
    }
    return recurringActivityController;
};
router.post('/recurring-activities/next-occurrence', auth_1.authenticateToken, (req, res, next) => getController().calculateNextOccurrence(req, res).catch(next));
router.post('/recurring-activities/occurrences', auth_1.authenticateToken, (req, res, next) => getController().generateOccurrences(req, res).catch(next));
router.post('/recurring-activities/parse', auth_1.authenticateToken, (req, res, next) => getController().parseRecurrenceString(req, res).catch(next));
router.post('/recurring-activities/format', auth_1.authenticateToken, (req, res, next) => getController().formatRecurrenceRule(req, res).catch(next));
router.post('/recurring-activities/create-instances', auth_1.authenticateToken, (req, res, next) => getController().createRecurringInstances(req, res).catch(next));
router.post('/recurring-activities/preview', auth_1.authenticateToken, (req, res, next) => getController().previewRecurringActivity(req, res).catch(next));
router.get('/recurring-activities/frequencies', auth_1.authenticateToken, (req, res, next) => getController().getFrequencies(req, res).catch(next));
//# sourceMappingURL=recurringActivities.js.map