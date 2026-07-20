"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const wikiController_1 = require("../../controllers/wikiController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.use(tenantContext_1.tenantContextMiddleware);
let wikiController;
const getController = () => {
    if (!wikiController) {
        wikiController = new wikiController_1.WikiController();
    }
    return wikiController;
};
router.get('/tree', (req, res) => getController().getPageTree(req, res));
router.get('/search', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.search, 'query'), (req, res) => getController().searchPages(req, res));
router.get('/pages', (req, res) => getController().getAllPages(req, res));
router.post('/pages', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.create, 'body'), (req, res) => getController().createPage(req, res));
router.get('/pages/:pageId', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.pageIdParam, 'params'), (req, res) => getController().getPage(req, res));
router.put('/pages/:pageId', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.pageIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.update, 'body'), (req, res) => getController().updatePage(req, res));
router.delete('/pages/:pageId', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.pageIdParam, 'params'), (req, res) => getController().deletePage(req, res));
router.get('/pages/:pageId/revisions', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.pageIdParam, 'params'), (req, res) => getController().getRevisions(req, res));
router.get('/pages/:pageId/revisions/:revisionId', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.revisionIdParam, 'params'), (req, res) => getController().getRevision(req, res));
router.post('/pages/:pageId/restore', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.pageIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.restore, 'body'), (req, res) => getController().restoreRevision(req, res));
router.put('/pages/:pageId/move', (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.pageIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.wikiSchemas.move, 'body'), (req, res) => getController().movePage(req, res));
//# sourceMappingURL=wiki.js.map