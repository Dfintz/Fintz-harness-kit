"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const rsiMemberIntelController_1 = require("../../controllers/v2/rsiMemberIntelController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const rsiMemberIntelSchemas_1 = require("../../schemas/rsiMemberIntelSchemas");
const router = (0, express_1.Router)({ mergeParams: true });
exports.router = router;
router.use(auth_1.authenticate);
let controller;
const getController = () => {
    if (!controller) {
        controller = new rsiMemberIntelController_1.RsiMemberIntelController();
    }
    return controller;
};
router.get('/', (req, res) => getController().listMembers(req, res));
router.post('/enrich-all', (req, res) => getController().enrichAll(req, res));
router.post('/clear-cache', (req, res) => getController().clearCache(req, res));
router.post('/audit', (0, schemaValidation_1.validateSchema)(rsiMemberIntelSchemas_1.rsiMemberIntelSchemas.auditBody, 'body'), (req, res) => getController().runAudit(req, res));
router.post('/validate-roles', (0, schemaValidation_1.validateSchema)(rsiMemberIntelSchemas_1.rsiMemberIntelSchemas.validateRolesBody, 'body'), (req, res) => getController().validateRoles(req, res));
router.get('/link-candidates', (0, schemaValidation_1.validateSchema)(rsiMemberIntelSchemas_1.rsiMemberIntelSchemas.linkCandidatesQuery, 'query'), (req, res) => getController().suggestLinkCandidates(req, res));
router.get('/:rsiHandle', (req, res) => getController().getMemberCard(req, res));
router.post('/:rsiHandle/enrich', (req, res) => getController().enrichMember(req, res));
router.post('/:rsiHandle/link', (0, schemaValidation_1.validateSchema)(rsiMemberIntelSchemas_1.rsiMemberIntelSchemas.manualLinkBody, 'body'), (req, res) => getController().manualLink(req, res));
router.delete('/:rsiHandle/link', (req, res) => getController().unlinkMember(req, res));
//# sourceMappingURL=rsiMemberIntel.js.map