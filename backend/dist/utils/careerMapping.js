"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDisplayCareer = resolveDisplayCareer;
const SHIP_CAREER_OVERRIDES = {
    asgard: 'Gunship',
    'avenger titan': 'Combat',
    'constellation andromeda': 'Combat',
    'mercury star runner': 'Transporter',
    'fortune teach\'s special': 'Salvaging',
    'golem teach\'s special': 'Mining',
    'nomad teach\'s special': 'Combat',
    'vulture teach\'s special': 'Salvaging',
    'mole teach\'s special': 'Mining',
    'starfarer teach\'s special': 'Hauling',
    'reclaimer teach\'s special': 'Salvaging',
    expanse: 'Industrial',
    legionnaire: 'Combat',
    vulcan: 'Medical',
    'hull b': 'Hauling',
    railen: 'Hauling',
    'e1 spirit': 'Hauling',
    'zeus mk ii mr': 'Combat',
    arrastra: 'Mining',
    crucible: 'Medical',
    galaxy: 'Multi-Role',
    genesis: 'Hauling',
    ironclad: 'Hauling',
    'ironclad assault': 'Combat',
    liberator: 'Capital Crew',
    nautilus: 'Combat',
    endeavor: 'Exploration',
    'hull d': 'Hauling',
    kraken: 'Capital Crew',
    'kraken privateer': 'Capital Crew',
    merchantman: 'Hauling',
    odyssey: 'Exploration',
    pioneer: 'Industrial',
    'hull e': 'Hauling',
    javelin: 'Capital Crew',
    orion: 'Mining',
};
const SIMPLE_RENAMES = {
    transporter: 'Hauling',
    support: 'Medical',
    ground: 'Driving',
    'ground combat': 'Driving',
    competition: 'Racing',
    gunship: 'Gunship',
    exploration: 'Exploration',
    'multi-role': 'Multi-Role',
    multirole: 'Multi-Role',
};
const CAPITAL_SIZES = new Set(['large', 'sub_capital', 'capital']);
function resolveRoleBasedCareer(roleLower, fallback) {
    if (roleLower.includes('mining') || roleLower.includes('refin')) {
        return 'Mining';
    }
    if (roleLower.includes('salvag')) {
        return 'Salvaging';
    }
    if (roleLower.includes('combat') || roleLower.includes('fighter')) {
        return 'Combat';
    }
    if (roleLower.includes('transport') ||
        roleLower.includes('freight') ||
        roleLower.includes('haul')) {
        return 'Hauling';
    }
    if (roleLower.includes('explor') || roleLower.includes('pathfinder')) {
        return 'Exploration';
    }
    if (roleLower.includes('medical')) {
        return 'Medical';
    }
    if (roleLower.includes('racing') || roleLower.includes('competition')) {
        return 'Racing';
    }
    return fallback;
}
function resolveDisplayCareer(rawCareer, role, size, shipName) {
    let career = rawCareer;
    if (shipName) {
        const override = SHIP_CAREER_OVERRIDES[shipName.toLowerCase()];
        if (override) {
            career = override;
        }
    }
    const careerLower = career.toLowerCase().trim();
    const roleLower = (role ?? '').toLowerCase();
    const sizeLower = (size ?? '').toLowerCase();
    const simpleResult = SIMPLE_RENAMES[careerLower];
    if (simpleResult) {
        return simpleResult;
    }
    switch (careerLower) {
        case 'industrial':
            if (roleLower.includes('mining') || roleLower.includes('refin')) {
                return 'Mining';
            }
            if (roleLower.includes('salvag')) {
                return 'Salvaging';
            }
            return 'Industrial';
        case 'combat':
            if (CAPITAL_SIZES.has(sizeLower)) {
                return 'Capital Crew';
            }
            return 'Combat';
        case 'starter':
            return resolveRoleBasedCareer(roleLower, 'Combat');
        default:
            if (!career || career.toLowerCase() === 'unknown') {
                const inferred = resolveRoleBasedCareer(roleLower, '');
                return inferred || 'Unknown';
            }
            return career;
    }
}
//# sourceMappingURL=careerMapping.js.map