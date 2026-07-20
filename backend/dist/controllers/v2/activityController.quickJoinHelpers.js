"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyActivityJoinedHelper = notifyActivityJoinedHelper;
exports.validateQuickJoinActivityHelper = validateQuickJoinActivityHelper;
exports.findActivityByQuickJoinTokenHelper = findActivityByQuickJoinTokenHelper;
exports.tokensEqualConstantTimeHelper = tokensEqualConstantTimeHelper;
const node_crypto_1 = __importDefault(require("node:crypto"));
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const Activity_1 = require("../../models/Activity");
const NotificationRouter_1 = require("../../services/communication/notifications/NotificationRouter");
const api_1 = require("../../types/api");
function notifyActivityJoinedHelper(input) {
    if (input.activity.creatorId && input.activity.creatorId !== input.userId) {
        input
            .notifyUser({
            context: NotificationRouter_1.NotificationContext.ACTIVITY_JOINED,
            userId: input.activity.creatorId,
            title: `${input.userName} joined your activity`,
            message: `${input.userName} joined "${input.activity.title}"`,
            senderId: input.userId,
            actionUrl: `/activities/${input.activity.id}`,
            metadata: { activityId: input.activity.id },
        })
            .catch(() => {
        });
    }
    if (input.activity.organizationId) {
        input.notifyOrg({
            context: NotificationRouter_1.NotificationContext.ACTIVITY_JOINED,
            organizationId: input.activity.organizationId,
            title: `${input.userName} joined an activity`,
            message: `${input.userName} joined "${input.activity.title}"`,
            senderId: input.userId,
            activityId: input.activity.id,
        });
    }
}
function validateQuickJoinActivityHelper(activity) {
    if (activity.metadata?.quickJoinTokenExpiry) {
        const expiry = new Date(activity.metadata.quickJoinTokenExpiry);
        if (expiry < new Date()) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'This join link has expired', 410);
        }
    }
    if (!activity.metadata?.quickJoin) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Quick join is not enabled for this activity', 400);
    }
    if (activity.status === Activity_1.ActivityStatus.CANCELLED ||
        activity.status === Activity_1.ActivityStatus.COMPLETED) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'This activity is no longer accepting participants', 400);
    }
}
async function findActivityByQuickJoinTokenHelper(token, tokensEqualConstantTime) {
    const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
    const activity = await activityRepo
        .createQueryBuilder('activity')
        .where("(activity.metadata::jsonb)->>'quickJoinToken' = :token", { token })
        .getOne();
    if (!activity) {
        return null;
    }
    const persistedToken = activity.metadata?.quickJoinToken;
    if (typeof persistedToken !== 'string') {
        return null;
    }
    return tokensEqualConstantTime(persistedToken, token) ? activity : null;
}
function tokensEqualConstantTimeHelper(left, right) {
    const leftDigest = node_crypto_1.default.createHash('sha256').update(left, 'utf8').digest();
    const rightDigest = node_crypto_1.default.createHash('sha256').update(right, 'utf8').digest();
    return node_crypto_1.default.timingSafeEqual(leftDigest, rightDigest);
}
//# sourceMappingURL=activityController.quickJoinHelpers.js.map