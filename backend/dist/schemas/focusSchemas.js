"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOrgFocusSchema = exports.setUserFocusSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const focusValues = [
    'Bounty Hunting',
    'Engineering',
    'Exploration',
    'Medical',
    'Piracy',
    'Infiltration',
    'Resources',
    'Scouting',
    'Security',
    'Smuggling',
    'Trading',
    'Transport',
];
exports.setUserFocusSchema = joi_1.default.object({
    primaryFocuses: joi_1.default.array()
        .items(joi_1.default.string().valid(...focusValues))
        .max(3)
        .required(),
    secondaryFocuses: joi_1.default.array()
        .items(joi_1.default.string().valid(...focusValues))
        .max(3)
        .required(),
});
exports.setOrgFocusSchema = joi_1.default.object({
    focuses: joi_1.default.array()
        .items(joi_1.default.string().valid(...focusValues))
        .max(2)
        .required(),
});
//# sourceMappingURL=focusSchemas.js.map