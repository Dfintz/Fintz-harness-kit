"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRecruitmentRoutes = void 0;
const express_1 = require("express");
const recruitmentController_1 = require("../controllers/recruitmentController");
const botOrUserAuth_1 = require("../middleware/botOrUserAuth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
let recruitmentController;
const getController = () => {
    if (!recruitmentController) {
        recruitmentController = new recruitmentController_1.RecruitmentController();
    }
    return recruitmentController;
};
const optionalBotOrUserAuth = (req, res, next) => {
    const hasBotToken = !!req.headers['x-bot-internal-token'];
    const hasJwt = !!req.headers['authorization'] || !!req.cookies?.access_token;
    const hasApiKey = !!req.headers['x-api-key'];
    if (!hasBotToken && !hasJwt && !hasApiKey) {
        next();
        return;
    }
    if (hasBotToken) {
        void (0, botOrUserAuth_1.botOrUserAuth)(req, res, next);
        return;
    }
    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);
    let authFailed = false;
    let settled = false;
    res.status = (code) => {
        if (!settled && code === 401) {
            authFailed = true;
            return res;
        }
        return originalStatus(code);
    };
    res.json = (body) => {
        if (authFailed && !settled) {
            settled = true;
            res.status = originalStatus;
            res.json = originalJson;
            next();
            return res;
        }
        return originalJson(body);
    };
    void (0, botOrUserAuth_1.botOrUserAuth)(req, res, (err) => {
        settled = true;
        res.status = originalStatus;
        res.json = originalJson;
        next(err);
    });
};
router.get('/', optionalBotOrUserAuth, (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.query, 'query'), (req, res) => getController().listRecruitments(req, res));
router.get('/my-applications', botOrUserAuth_1.botOrUserAuth, (req, res) => getController().getMyApplications(req, res));
router.get('/:id', optionalBotOrUserAuth, (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getRecruitment(req, res));
router.use(botOrUserAuth_1.botOrUserAuth);
router.post('/:id/discord-apply', (req, res) => getController().discordApply(req, res));
router.post('/:id/invite-binding', (req, res) => getController().createInviteBinding(req, res));
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.create, 'body'), (req, res) => getController().createRecruitment(req, res));
router.put('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.update, 'body'), (req, res) => getController().updateRecruitment(req, res));
router.delete('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteRecruitment(req, res));
router.put('/:id/status', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
router.post('/:id/apply', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.apply, 'body'), (req, res) => getController().submitApplication(req, res));
router.get('/:id/applications', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.applicationQuery, 'query'), (req, res) => getController().listApplications(req, res));
router.put('/:id/applications/:applicationId', (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.applicationParams, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.recruitmentSchemas.reviewApplication, 'body'), (req, res) => getController().reviewApplication(req, res));
const setRecruitmentRoutes = (app) => {
    app.use('/api/v2/recruitment', router);
    app.use('/api/recruitments', router);
};
exports.setRecruitmentRoutes = setRecruitmentRoutes;
//# sourceMappingURL=recruitmentRoutes.js.map