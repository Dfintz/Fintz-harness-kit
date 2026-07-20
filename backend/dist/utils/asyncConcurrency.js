"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapWithConcurrency = mapWithConcurrency;
async function mapWithConcurrency(items, concurrency, worker) {
    if (items.length === 0) {
        return [];
    }
    const results = new Array(items.length);
    let nextIndex = 0;
    const runWorker = async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await worker(items[currentIndex]);
        }
    };
    const workerCount = Math.min(Math.max(concurrency, 1), items.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
}
//# sourceMappingURL=asyncConcurrency.js.map