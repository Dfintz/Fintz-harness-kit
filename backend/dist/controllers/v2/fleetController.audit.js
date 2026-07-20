"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFleetAuditLogHandler = getFleetAuditLogHandler;
const FleetAuditLogger_1 = require("../../services/fleet/FleetAuditLogger");
const tenantHelpers_1 = require("../../utils/tenantHelpers");
const fleetController_errors_1 = require("./fleetController.errors");
async function getFleetAuditLogHandler(req, res) {
    try {
        const { id: fleetId } = req.params;
        const organizationId = (0, tenantHelpers_1.getOrganizationId)(req);
        const { action, limit } = req.query;
        const entries = await FleetAuditLogger_1.fleetAuditLogger.getFleetAuditLog({
            fleetId,
            organizationId,
            action: action,
            limit: Math.min(limit ? Number.parseInt(limit, 10) : 100, 200),
        });
        res.success(entries);
    }
    catch (error) {
        (0, fleetController_errors_1.sendFleetInternalErrorResponse)(res, error, 'Fleet audit log query failed', req.path);
    }
}
//# sourceMappingURL=fleetController.audit.js.map