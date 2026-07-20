"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const commentController_1 = require("../../controllers/v2/commentController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const commentSchemas_1 = require("../../schemas/commentSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let commentController;
const getController = () => {
    if (!commentController) {
        commentController = new commentController_1.CommentController();
    }
    return commentController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.query, 'query'), (req, res) => getController().listComments(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.create, 'body'), (req, res) => getController().createComment(req, res));
router.get('/:commentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (req, res) => getController().getComment(req, res));
router.put('/:commentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.update, 'body'), (req, res) => getController().updateComment(req, res));
router.delete('/:commentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (req, res) => getController().deleteComment(req, res));
router.post('/:commentId/reply', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.reply, 'body'), (req, res) => getController().replyToComment(req, res));
router.post('/:commentId/like', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (req, res) => getController().likeComment(req, res));
router.delete('/:commentId/like', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (req, res) => getController().unlikeComment(req, res));
router.get('/:commentId/replies', ...orgAuth, (0, schemaValidation_1.validateSchema)(commentSchemas_1.commentSchemas.param, 'params'), (req, res) => getController().getReplies(req, res));
//# sourceMappingURL=comments.js.map