"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStatRecord = void 0;
const toStatRecord = (rows, key) => rows.reduce((acc, curr) => {
    acc[curr[key] ?? 'unknown'] = Number.parseInt(curr.count);
    return acc;
}, {});
exports.toStatRecord = toStatRecord;
//# sourceMappingURL=fleetController.stats.js.map