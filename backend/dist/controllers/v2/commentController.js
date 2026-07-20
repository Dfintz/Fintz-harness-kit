"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentController = void 0;
const CommentService_1 = require("../../services/comment/CommentService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class CommentController extends BaseController_1.BaseController {
    commentService;
    constructor() {
        super();
        this.commentService = new CommentService_1.CommentService();
    }
    listComments = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { resourceType, resourceId, page, limit, sortOrder } = req.query;
            const result = await this.commentService.listComments(organizationId, {
                resourceType: resourceType,
                resourceId: resourceId,
                page: page ? Number.parseInt(page, 10) : undefined,
                limit: limit ? Math.min(Number.parseInt(limit, 10), 200) : undefined,
                sortOrder: sortOrder,
            });
            res.json({
                success: true,
                data: result.data,
                meta: { total: result.total },
            });
        });
    };
    getComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const comment = await this.commentService.getComment(organizationId, req.params.commentId);
            if (!comment) {
                res.status(404).json({ success: false, error: 'Comment not found' });
                return;
            }
            res.json({ success: true, data: comment });
        });
    };
    createComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const comment = await this.commentService.createComment(organizationId, userId, req.user?.username, body);
            res.status(201).json({ success: true, data: comment });
        });
    };
    updateComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { content } = req.body;
            const comment = await this.commentService.updateComment(organizationId, userId, req.params.commentId, content);
            res.json({ success: true, data: comment });
        });
    };
    deleteComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            await this.commentService.deleteComment(organizationId, userId, req.params.commentId);
            res.json({ success: true, message: 'Comment deleted' });
        });
    };
    replyToComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { content } = req.body;
            const reply = await this.commentService.replyToComment(organizationId, userId, req.user?.username, req.params.commentId, content);
            res.status(201).json({ success: true, data: reply });
        });
    };
    likeComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            await this.commentService.likeComment(organizationId, userId, req.params.commentId);
            res.json({ success: true, message: 'Comment liked' });
        });
    };
    unlikeComment = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            await this.commentService.unlikeComment(organizationId, userId, req.params.commentId);
            res.json({ success: true, message: 'Comment unliked' });
        });
    };
    getReplies = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const replies = await this.commentService.getReplies(organizationId, req.params.commentId);
            res.json({ success: true, data: replies });
        });
    };
}
exports.CommentController = CommentController;
//# sourceMappingURL=commentController.js.map