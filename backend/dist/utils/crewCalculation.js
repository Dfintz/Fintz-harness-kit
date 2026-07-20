"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCrewRequirements = calculateCrewRequirements;
exports.resolveShipCrew = resolveShipCrew;
exports.calculateCrewFromRequirements = calculateCrewFromRequirements;
const CREW_MULTIPLIERS = {
    lean: 0.4,
    conservative: 0.5,
};
function calculateCrewRequirements(crew, mode = 'lean') {
    const effectiveCrew = crew && crew > 0 ? crew : 1;
    const multiplier = CREW_MULTIPLIERS[mode];
    const minCrew = Math.max(1, Math.ceil(effectiveCrew * multiplier));
    return {
        minCrew,
        maxCrew: effectiveCrew,
        multiplier,
        mode,
    };
}
function resolveShipCrew(ship) {
    return Math.max(ship.maxCrew ?? 0, ship.crew ?? 0) || 1;
}
function calculateCrewFromRequirements(requirements) {
    let total = 0;
    for (const req of requirements) {
        if (req.requirementType === 'specific') {
            total += req.count * (req.crewPerShip || 1);
        }
        else if (req.requirementType === 'role') {
            total += req.count * (req.avgCrewPerShip || 1);
        }
    }
    return total;
}
//# sourceMappingURL=crewCalculation.js.map