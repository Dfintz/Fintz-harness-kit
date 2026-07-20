"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const globalSearchController_1 = require("../../controllers/globalSearchController");
const opportunitySearchController_1 = require("../../controllers/opportunitySearchController");
const activityController_1 = require("../../controllers/v2/activityController");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const globalSearchSchemas_1 = require("../../schemas/globalSearchSchemas");
const opportunitySearchSchemas_1 = require("../../schemas/opportunitySearchSchemas");
const router = (0, express_1.Router)();
exports.router = router;
router.get('/opportunities', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(opportunitySearchSchemas_1.opportunitySearchSchemas.searchQuery, 'query'), (req, res) => opportunitySearchController_1.opportunitySearchController.searchOpportunities(req, res));
const activityController = new activityController_1.ActivityControllerV2();
router.get('/activities/:id', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(joi_1.default.object({ id: joi_1.default.string().uuid().required() }), 'params'), (req, res) => activityController.getPublicActivityById(req, res));
router.get('/global', rateLimiting_1.generalRateLimiter, (0, schemaValidation_1.validateSchema)(globalSearchSchemas_1.globalSearchSchemas.searchQuery, 'query'), (req, res) => globalSearchController_1.globalSearchController.search(req, res));
router.get('/users', (req, res) => {
    res.success([]);
});
router.get('/organizations', (req, res) => {
    res.success([]);
});
router.get('/fleets', (req, res) => {
    res.success([]);
});
router.get('/activities', (req, res) => {
    res.success([]);
});
router.get('/suggestions', (req, res) => {
    res.success([]);
});
router.get('/trending', (req, res) => {
    res.success([]);
});
//# sourceMappingURL=search.js.map