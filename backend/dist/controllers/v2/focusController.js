"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FocusControllerV2 = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const focusSchemas_1 = require("../../schemas/focusSchemas");
const FocusService_1 = require("../../services/user/FocusService");
const api_1 = require("../../types/api");
class FocusControllerV2 {
    service = new FocusService_1.FocusService();
    async getFocusList(_req, res) {
        const focuses = this.service.getFocusList();
        res.success({ focuses });
    }
    async setUserFocus(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { error, value } = focusSchemas_1.setUserFocusSchema.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        await this.service.setUserFocus(userId, value.primaryFocuses, value.secondaryFocuses);
        res.success({ message: 'User focuses updated' });
    }
    async getUserFocus(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const focus = await this.service.getUserFocus(userId);
        res.success({ focus: focus ?? null });
    }
    async setOrgFocus(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const { orgId } = req.params;
        const { error, value } = focusSchemas_1.setOrgFocusSchema.validate(req.body);
        if (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, error.message, 400);
        }
        await this.service.setOrgFocus(orgId, value.focuses);
        res.success({ message: 'Organization focuses updated' });
    }
    async getOrgFocus(req, res) {
        const { orgId } = req.params;
        const focus = await this.service.getOrgFocus(orgId);
        res.success({ focus: focus ?? null });
    }
}
exports.FocusControllerV2 = FocusControllerV2;
//# sourceMappingURL=focusController.js.map