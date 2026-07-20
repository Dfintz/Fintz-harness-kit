"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationService = void 0;
const Operation_1 = require("../../models/Operation");
const TenantService_1 = require("../base/TenantService");
class OperationService extends TenantService_1.TenantService {
    constructor(repository) {
        super(repository, { enableCache: true, cacheTTL: 300 });
    }
    async createOperation(orgId, data, userId) {
        if (!data.name || !data.type) {
            throw new Error('name and type are required');
        }
        return this.create(orgId, {
            type: data.type,
            name: data.name,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            participants: data.participants || [],
            status: Operation_1.OperationStatus.PLANNED,
            createdBy: userId
        });
    }
    async getOperationsByType(orgId, type) {
        return this.findAll(orgId, { where: { type } });
    }
    async updateOperationStatus(orgId, opId, status) {
        const op = await this.findById(orgId, opId);
        if (!op) {
            return null;
        }
        op.status = status;
        return this.update(orgId, opId, op);
    }
    async getActiveOperations(orgId) {
        return this.findAll(orgId, { where: { status: Operation_1.OperationStatus.IN_PROGRESS } });
    }
}
exports.OperationService = OperationService;
//# sourceMappingURL=OperationService.js.map