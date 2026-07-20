"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TYPE_TO_ROLE = exports.ALL_SHIP_TYPES = exports.SHIP_ROLES = exports.SHIP_ROLE_TYPES = void 0;
exports.getShipRoleEmoji = getShipRoleEmoji;
exports.shipMatchesRequirement = shipMatchesRequirement;
exports.SHIP_ROLE_TYPES = {
    Combat: [
        'Light Fighter',
        'Medium Fighter',
        'Heavy Fighter',
        'Gunship',
        'Heavy Gunship',
        'Bomber',
        'Heavy Bomber',
        'Corvette',
        'Frigate',
        'Destroyer',
    ],
    'Combat Support': [
        'Interdictor',
        'Electronic Warfare',
        'Boarding',
        'Dropship',
        'Heavy Dropship',
        'Minelayer',
    ],
    Logistics: [
        'Micro Freight',
        'Light Freight',
        'Medium Freight',
        'Heavy Freight',
        'Super Freight',
        'Medium Data',
        'Landcraft Transport',
        'Passenger Transport',
        'Prisoner Transport',
        'Reporting',
        'Tractor Beam',
    ],
    Support: [
        'Medical',
        'Recovery',
        'Medium Refuel',
        'Heavy Refuel',
        'Snub',
        'Stealth',
        'Light Carrier',
        'Medium Carrier',
        'Commerce',
        'Medium Rearm',
        'Medium Repair',
        'Heavy Repair',
    ],
    Industrial: [
        'Light Mining',
        'Medium Mining',
        'Heavy Mining',
        'Super Mining',
        'Refining',
        'Light Salvage',
        'Medium Salvage',
        'Heavy Salvage',
        'Light Science',
        'Heavy Science',
        'Heavy Construction',
        'Scanning',
        'Fabrication',
    ],
    Bespoke: [
        'Personal Transport',
        'Racing',
        'Luxury Touring',
        'Pathfinder',
        'Expedition',
        'Modular',
    ],
};
exports.SHIP_ROLES = Object.keys(exports.SHIP_ROLE_TYPES);
exports.ALL_SHIP_TYPES = Object.values(exports.SHIP_ROLE_TYPES).flat();
exports.TYPE_TO_ROLE = {};
for (const [role, types] of Object.entries(exports.SHIP_ROLE_TYPES)) {
    for (const t of types) {
        exports.TYPE_TO_ROLE[t] = role;
    }
}
const ROLE_EMOJI = {
    Combat: '⚔️',
    'Combat Support': '🛡️',
    Logistics: '📦',
    Support: '🩹',
    Industrial: '⛏️',
    Bespoke: '🔮',
};
function getShipRoleEmoji(role) {
    if (!role) {
        return '🚀';
    }
    return ROLE_EMOJI[role] ?? '🚀';
}
function shipMatchesRequirement(shipRole, shipType, req) {
    if (req.role) {
        if (!shipRole) {
            return false;
        }
        const normalised = shipRole.toLowerCase().trim();
        const reqNormalised = req.role.toLowerCase().trim();
        if (normalised !== reqNormalised) {
            return false;
        }
    }
    if (req.type) {
        if (!shipType) {
            return false;
        }
        const normalised = shipType.toLowerCase().trim();
        const reqNormalised = req.type.toLowerCase().trim();
        if (!normalised.includes(reqNormalised) && normalised !== reqNormalised) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=shipTaxonomy.js.map