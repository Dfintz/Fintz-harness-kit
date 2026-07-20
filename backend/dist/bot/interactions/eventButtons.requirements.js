"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRequiredShipTypes = parseRequiredShipTypes;
exports.computeFilledCounts = computeFilledCounts;
const shipTaxonomy_1 = require("../constants/shipTaxonomy");
function legacyNameToRequirement(name) {
    const parentRole = shipTaxonomy_1.TYPE_TO_ROLE[name];
    return {
        role: parentRole,
        type: parentRole ? name : undefined,
        count: 1,
        filled: 0,
        strictness: 'preferred',
    };
}
function parseRequiredShipTypes(raw) {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return [];
        }
        if (typeof parsed[0] === 'object' && 'count' in parsed[0]) {
            return parsed;
        }
        if (typeof parsed[0] === 'string') {
            return parsed.map(legacyNameToRequirement);
        }
        return [];
    }
    catch {
        const names = raw
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        return names.map(legacyNameToRequirement);
    }
}
function computeFilledCounts(reqs, ships) {
    const claimed = new Set();
    for (const req of reqs) {
        let filled = 0;
        for (const s of ships) {
            const key = s.id ?? `${s.ownerId}_${s.shipType}`;
            if (claimed.has(key)) {
                continue;
            }
            if ((0, shipTaxonomy_1.shipMatchesRequirement)(s.role, s.shipType, req)) {
                filled++;
                claimed.add(key);
                if (filled >= req.count) {
                    break;
                }
            }
        }
        req.filled = filled;
    }
}
//# sourceMappingURL=eventButtons.requirements.js.map