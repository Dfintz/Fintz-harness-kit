"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationCommandController = void 0;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const OperationCommandService_1 = require("../../services/activity/OperationCommandService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
class OperationCommandController {
    commandService = new OperationCommandService_1.OperationCommandService();
    async setCommandChain(req, res) {
        try {
            const { id: activityId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            const organizationId = req.user?.currentOrganizationId;
            if (!userId || !organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const { fleetCommanders, squadronLeaders } = req.body;
            const chain = await this.commandService.setCommandChain(activityId, organizationId, userId, userName, fleetCommanders ?? [], squadronLeaders ?? []);
            res.status(201).success(chain);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to set command chain'), 500);
        }
    }
    async getCommandChain(req, res) {
        try {
            const { id: activityId } = req.params;
            const chain = await this.commandService.getCommandChain(activityId);
            res.success({ chain });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get command chain'), 500);
        }
    }
    async issueCommand(req, res) {
        try {
            const { id: activityId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            const organizationId = req.user?.currentOrganizationId;
            if (!userId || !organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const { type, priority, message, targetScope, payload } = req.body;
            const command = await this.commandService.issueCommand(activityId, organizationId, { userId, userName }, type, message, targetScope, { priority: (priority ?? 'routine'), payload });
            res.status(201).success({
                id: command.id,
                type: command.type,
                priority: command.priority,
                message: command.message,
                issuedAt: command.issuedAt,
                recipientCount: command.targetScope.resolvedRecipientIds.length,
                status: command.status,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to issue command'), 500);
        }
    }
    async getCommands(req, res) {
        try {
            const { id: activityId } = req.params;
            const commands = await this.commandService.getCommands(activityId);
            const summaries = commands.map(cmd => ({
                id: cmd.id,
                type: cmd.type,
                priority: cmd.priority,
                message: cmd.message,
                issuedByName: cmd.issuedByName,
                issuedAt: cmd.issuedAt,
                status: cmd.status,
                totalRecipients: cmd.targetScope.resolvedRecipientIds.length,
                acknowledgedCount: cmd.acknowledgements.length,
            }));
            res.success({ commands: summaries });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get commands'), 500);
        }
    }
    async getCommand(req, res) {
        try {
            const { cmdId } = req.params;
            const command = await this.commandService.getCommand(cmdId);
            if (!command) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'Command not found', 404);
            }
            res.success(command);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get command'), 500);
        }
    }
    async acknowledgeCommand(req, res) {
        try {
            const { cmdId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const { response } = req.body;
            const command = await this.commandService.acknowledgeCommand(cmdId, userId, userName, response);
            res.success({
                commandId: command.id,
                status: command.status,
                acknowledgedCount: command.acknowledgements.length,
                totalRecipients: command.targetScope.resolvedRecipientIds.length,
                allAcknowledged: command.status === 'acknowledged',
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to acknowledge command'), 500);
        }
    }
    async preflightCheck(req, res) {
        try {
            const { id: activityId } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username ?? 'Unknown';
            const organizationId = req.user?.currentOrganizationId;
            if (!userId || !organizationId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const command = await this.commandService.issuePreflightCheck(activityId, organizationId, userId, userName);
            res.status(201).success({
                id: command.id,
                type: command.type,
                message: command.message,
                recipientCount: command.targetScope.resolvedRecipientIds.length,
                status: command.status,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to issue pre-flight check'), 500);
        }
    }
}
exports.OperationCommandController = OperationCommandController;
//# sourceMappingURL=operationCommandController.js.map