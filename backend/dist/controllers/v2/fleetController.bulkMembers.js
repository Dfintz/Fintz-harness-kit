"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBulkUpdates = validateBulkUpdates;
exports.validateBulkDeleteItems = validateBulkDeleteItems;
exports.applyBulkUpdate = applyBulkUpdate;
exports.applyBulkDelete = applyBulkDelete;
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const api_1 = require("../../types/api");
function validateBulkUpdates(updates) {
    for (const update of updates) {
        if (!update?.fleetId || !update?.shipId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Each update must include fleetId and shipId', 400);
        }
        if (update.role === undefined && update.notes === undefined) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Each update must include at least one of role or notes', 400);
        }
    }
}
function validateBulkDeleteItems(items) {
    for (const item of items) {
        if (!item?.fleetId || !item?.shipId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Each item must include fleetId and shipId', 400);
        }
    }
}
async function applyBulkUpdate(txRepo, organizationId, update) {
    const assignment = await txRepo.findOne({
        where: { fleetId: update.fleetId, shipId: update.shipId, organizationId },
    });
    if (!assignment) {
        return { updated: false };
    }
    if (update.role !== undefined) {
        assignment.role = update.role;
    }
    if (update.notes !== undefined) {
        assignment.notes = update.notes;
    }
    await txRepo.save(assignment);
    return { updated: true };
}
async function applyBulkDelete(txRepo, organizationId, item) {
    const assignment = await txRepo.findOne({
        where: { fleetId: item.fleetId, shipId: item.shipId, organizationId },
    });
    if (!assignment) {
        return false;
    }
    await txRepo.remove(assignment);
    return true;
}
//# sourceMappingURL=fleetController.bulkMembers.js.map