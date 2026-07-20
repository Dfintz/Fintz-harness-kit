"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFederationPermission = requireFederationPermission;
exports.requireFederationViewAccess = requireFederationViewAccess;
const apiErrors_1 = require("../../utils/apiErrors");
async function requireFederationPermission(ambassadorService, federationId, userId, permission, errorMessage) {
    const hasAccess = await ambassadorService.hasPermission(federationId, userId, permission);
    if (!hasAccess) {
        throw new apiErrors_1.ForbiddenError(errorMessage ?? `Ambassador '${permission}' permission required`);
    }
}
async function requireFederationViewAccess(ambassadorService, federationId, userId, resourceName) {
    return requireFederationPermission(ambassadorService, federationId, userId, 'view', `You must be a federation ambassador to view ${resourceName ?? 'this resource'}`);
}
//# sourceMappingURL=federationPermissions.js.map