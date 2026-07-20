"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FIND_BATCH_SIZE = void 0;
exports.findInBatches = findInBatches;
const typeorm_1 = require("typeorm");
exports.DEFAULT_FIND_BATCH_SIZE = 500;
async function findInBatches(repository, options, handler) {
    const requestedBatchSize = options.batchSize ?? exports.DEFAULT_FIND_BATCH_SIZE;
    const batchSize = requestedBatchSize > 0 ? requestedBatchSize : exports.DEFAULT_FIND_BATCH_SIZE;
    const cursorColumn = (options.cursorColumn ?? 'id');
    const baseWhere = options.where ?? {};
    let processed = 0;
    let cursor;
    for (;;) {
        const where = cursor === undefined
            ? baseWhere
            : { ...baseWhere, [cursorColumn]: (0, typeorm_1.MoreThan)(cursor) };
        const batch = await repository.find({
            where,
            relations: options.relations,
            order: { [cursorColumn]: 'ASC' },
            take: batchSize,
        });
        if (batch.length === 0) {
            break;
        }
        await handler(batch);
        processed += batch.length;
        if (batch.length < batchSize) {
            break;
        }
        const lastRow = batch.at(-1);
        if (!lastRow) {
            break;
        }
        cursor = lastRow[cursorColumn];
    }
    return processed;
}
//# sourceMappingURL=findInBatches.js.map