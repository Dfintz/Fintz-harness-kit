"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuesCollectionJobAdapter = void 0;
const DuesCollectionOrchestratorService_1 = require("../../services/treasury/DuesCollectionOrchestratorService");
const logger_1 = require("../../utils/logger");
class DuesCollectionJobAdapter {
    orchestrator;
    constructor(orchestrator = new DuesCollectionOrchestratorService_1.DuesCollectionOrchestratorService()) {
        this.orchestrator = orchestrator;
    }
    async runDailyCollection() {
        logger_1.logger.info('Starting daily dues collection...');
        const result = await this.orchestrator.collectAllDues();
        logger_1.logger.info(`Dues collection completed: ${result.collected} collected, ${result.errors} errors`);
        return result;
    }
}
exports.DuesCollectionJobAdapter = DuesCollectionJobAdapter;
//# sourceMappingURL=DuesCollectionJobAdapter.js.map