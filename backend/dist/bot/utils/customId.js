"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CUSTOM_ID_LENGTH = void 0;
exports.buildCustomId = buildCustomId;
exports.parseCustomId = parseCustomId;
exports.customIdScope = customIdScope;
exports.isCustomIdWithinLimit = isCustomIdWithinLimit;
const SEPARATOR = '_';
exports.MAX_CUSTOM_ID_LENGTH = 100;
function buildCustomId(prefix, action, ...params) {
    return [prefix, action, ...params].join(SEPARATOR);
}
function parseCustomId(customId) {
    const [prefix = '', action = '', ...params] = customId.split(SEPARATOR);
    return { prefix, action, params };
}
function customIdScope(customId) {
    const { prefix, action } = parseCustomId(customId);
    return action ? buildCustomId(prefix, action) : prefix;
}
function isCustomIdWithinLimit(customId) {
    return customId.length <= exports.MAX_CUSTOM_ID_LENGTH;
}
//# sourceMappingURL=customId.js.map