"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeShipMetrics = computeShipMetrics;
exports.computeOperationalScore = computeOperationalScore;
const Fleet_1 = require("../../models/Fleet");
function computeShipMetrics(ships) {
    let flightReadyCount = 0;
    let combatCapable = 0;
    let cargoCapable = 0;
    let totalCrew = 0;
    for (const ship of ships) {
        if (ship.status === 'flight_ready') {
            flightReadyCount++;
        }
        const role = (ship.role ?? '').toLowerCase();
        if (role.includes('combat') || role.includes('fighter') || role.includes('bomber')) {
            combatCapable++;
        }
        if (role.includes('cargo') || role.includes('freight') || role.includes('transport')) {
            cargoCapable++;
        }
        totalCrew += ship.maxCrew ?? 0;
    }
    return { flightReadyCount, combatCapable, cargoCapable, totalCrew };
}
function computeOperationalScore(fleet) {
    const ops = fleet.operationalStats;
    if (ops?.averageUptime !== null && ops?.averageUptime !== undefined) {
        return Math.min(ops.averageUptime, 100);
    }
    if (fleet.status === Fleet_1.FleetStatus.DEPLOYED) {
        return 100;
    }
    return 0;
}
//# sourceMappingURL=fleetController.metrics.js.map