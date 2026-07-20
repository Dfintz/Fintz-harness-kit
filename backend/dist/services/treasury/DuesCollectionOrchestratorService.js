"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuesCollectionOrchestratorService = void 0;
const data_source_1 = require("../../data-source");
const OrgDues_1 = require("../../models/OrgDues");
const logger_1 = require("../../utils/logger");
const DuesService_1 = require("./DuesService");
class DuesCollectionOrchestratorService {
    duesService;
    duesRepository;
    static BATCH_SIZE = 100;
    constructor(duesService = new DuesService_1.DuesService(), duesRepository = data_source_1.AppDataSource.getRepository(OrgDues_1.OrgDues)) {
        this.duesService = duesService;
        this.duesRepository = duesRepository;
    }
    async collectAllDues(now = new Date()) {
        const utcSnapshot = this.duesService.getUtcCalendarSnapshot(now);
        let collected = 0;
        let errors = 0;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const batch = await this.duesRepository.find({
                where: { isActive: true },
                take: DuesCollectionOrchestratorService.BATCH_SIZE,
                skip: offset,
                order: { createdAt: 'ASC' },
            });
            if (batch.length < DuesCollectionOrchestratorService.BATCH_SIZE) {
                hasMore = false;
            }
            offset += DuesCollectionOrchestratorService.BATCH_SIZE;
            for (const dues of batch) {
                if (!this.duesService.isDueToday(dues, utcSnapshot)) {
                    continue;
                }
                try {
                    const didCollect = await this.duesService.collectDueIfEligible(dues, utcSnapshot.collectionDateUtc);
                    if (!didCollect) {
                        logger_1.logger.info('Dues collection skipped due to idempotency guard', {
                            organizationId: dues.organizationId,
                            duesId: dues.id,
                            collectionDateUtc: utcSnapshot.collectionDateUtc,
                        });
                        continue;
                    }
                    collected++;
                    logger_1.logger.info('Dues collected', {
                        organizationId: dues.organizationId,
                        duesId: dues.id,
                        amount: dues.amount,
                        collectionDateUtc: utcSnapshot.collectionDateUtc,
                    });
                }
                catch (error) {
                    errors++;
                    logger_1.logger.error('Dues collection failed', {
                        error: String(error),
                        organizationId: dues.organizationId,
                        duesId: dues.id,
                        collectionDateUtc: utcSnapshot.collectionDateUtc,
                    });
                }
            }
        }
        return { collected, errors };
    }
}
exports.DuesCollectionOrchestratorService = DuesCollectionOrchestratorService;
//# sourceMappingURL=DuesCollectionOrchestratorService.js.map