"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const pollController_1 = require("../../controllers/pollController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const pollSchemas_1 = require("../../schemas/pollSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let pollController;
const getController = () => {
    if (!pollController) {
        pollController = new pollController_1.PollController();
    }
    return pollController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/polls', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.query, 'query'), (req, res) => getController().listPolls(req, res));
router.post('/polls', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.create, 'body'), (req, res) => getController().createPoll(req, res));
router.get('/polls/:pollId', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (req, res) => getController().getPoll(req, res));
router.put('/polls/:pollId', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.update, 'body'), (req, res) => getController().updatePoll(req, res));
router.delete('/polls/:pollId', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (req, res) => getController().deletePoll(req, res));
router.post('/polls/:pollId/vote', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.vote, 'body'), (req, res) => getController().castVote(req, res));
router.get('/polls/:pollId/results', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (req, res) => getController().getResults(req, res));
router.post('/polls/:pollId/close', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (req, res) => getController().closePoll(req, res));
router.post('/polls/:pollId/mirrors', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.mirrorToGuild, 'body'), (req, res) => getController().mirrorToGuild(req, res));
router.post('/polls/:pollId/mirrors/federation', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.mirrorToFederation, 'body'), (req, res) => getController().mirrorToFederation(req, res));
router.get('/polls/:pollId/mirrors', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.param, 'params'), (req, res) => getController().listMirrors(req, res));
router.delete('/polls/:pollId/mirrors/:mirrorId', ...orgAuth, (0, schemaValidation_1.validateSchema)(pollSchemas_1.pollSchemas.mirrorParam, 'params'), (req, res) => getController().deleteMirror(req, res));
//# sourceMappingURL=voting.js.map