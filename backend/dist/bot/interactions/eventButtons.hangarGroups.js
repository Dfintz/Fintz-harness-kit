"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_HANGAR_OPTIONS = void 0;
exports.buildHangarGroups = buildHangarGroups;
const shipTaxonomy_1 = require("../constants/shipTaxonomy");
exports.MAX_HANGAR_OPTIONS = 24;
function firstLetter(s) {
    return s.displayName[0]?.toUpperCase() ?? '#';
}
function chunkShipsToGroups(ships, opts) {
    const groups = [];
    const multiChunk = ships.length > exports.MAX_HANGAR_OPTIONS;
    for (let i = 0; i < ships.length; i += exports.MAX_HANGAR_OPTIONS) {
        const slice = ships.slice(i, i + exports.MAX_HANGAR_OPTIONS);
        const chunkIndex = i / exports.MAX_HANGAR_OPTIONS;
        const first = firstLetter(slice[0]);
        const last = firstLetter(slice.at(-1) ?? slice[0]);
        const range = first === last ? first : `${first}–${last}`;
        const label = multiChunk ? `${opts.labelPrefix} (${range})` : opts.labelPrefix;
        groups.push({
            key: `${opts.keyPrefix}:${chunkIndex}`,
            label: label.slice(0, 100),
            emoji: opts.emoji,
            ships: slice,
        });
    }
    return groups;
}
function groupBucketByRole(ships, opts) {
    const byRole = new Map();
    for (const s of ships) {
        const role = s.roleCategory ?? 'Other';
        const list = byRole.get(role);
        if (list) {
            list.push(s);
        }
        else {
            byRole.set(role, [s]);
        }
    }
    const extraRoles = [...byRole.keys()].filter(r => !shipTaxonomy_1.SHIP_ROLES.includes(r) && r !== 'Other');
    const orderedRoles = [
        ...shipTaxonomy_1.SHIP_ROLES.filter(r => byRole.has(r)),
        ...extraRoles,
        ...(byRole.has('Other') ? ['Other'] : []),
    ];
    const bucketPrefix = opts.matched ? 'm' : 'n';
    const groups = [];
    for (const role of orderedRoles) {
        const roleShips = byRole.get(role) ?? [];
        const emoji = opts.matched ? '✅' : (0, shipTaxonomy_1.getShipRoleEmoji)(role);
        groups.push(...chunkShipsToGroups(roleShips, {
            labelPrefix: opts.matched ? `Matching · ${role}` : role,
            keyPrefix: `${bucketPrefix}:${role}`,
            emoji,
        }));
    }
    return groups;
}
function buildHangarGroups(suggestions) {
    const hasMatch = suggestions.some(s => s.matchesRequirement);
    const hasNonMatch = suggestions.some(s => !s.matchesRequirement);
    if (hasMatch && hasNonMatch) {
        return [
            ...groupBucketByRole(suggestions.filter(s => s.matchesRequirement), { matched: true }),
            ...groupBucketByRole(suggestions.filter(s => !s.matchesRequirement), { matched: false }),
        ];
    }
    return groupBucketByRole(suggestions, { matched: false });
}
//# sourceMappingURL=eventButtons.hangarGroups.js.map