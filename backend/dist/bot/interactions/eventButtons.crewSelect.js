"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrewShipIdentifier = getCrewShipIdentifier;
exports.buildCrewSelectValue = buildCrewSelectValue;
exports.parseCrewSelectValue = parseCrewSelectValue;
const CREW_SELECT_VALUE_PREFIX = 'sid:';
function getCrewShipIdentifier(ship) {
    const identifier = ship.id ?? ship.shipId ?? ship.ownerId;
    const normalized = identifier?.trim();
    return normalized || null;
}
function buildCrewSelectValue(shipIdentifier, index) {
    return `${CREW_SELECT_VALUE_PREFIX}${encodeURIComponent(shipIdentifier)}:${index}`;
}
function parseCrewSelectValue(value) {
    const match = /^sid:([^:]+):(\d+)$/.exec(value);
    if (!match) {
        return {
            shipIdentifier: value,
            shipIndex: undefined,
        };
    }
    try {
        return {
            shipIdentifier: decodeURIComponent(match[1]),
            shipIndex: Number.parseInt(match[2], 10),
        };
    }
    catch {
        return {
            shipIdentifier: value,
            shipIndex: undefined,
        };
    }
}
//# sourceMappingURL=eventButtons.crewSelect.js.map