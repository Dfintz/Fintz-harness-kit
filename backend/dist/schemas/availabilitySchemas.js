"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findBestTimes = exports.setAvailability = void 0;
const joi_1 = __importDefault(require("joi"));
exports.setAvailability = joi_1.default.object({
    slots: joi_1.default.array()
        .items(joi_1.default.object({
        dayOfWeek: joi_1.default.number().integer().min(0).max(6).required(),
        startMinute: joi_1.default.number().integer().min(0).max(1439).required(),
        endMinute: joi_1.default.number().integer().min(0).max(1439).required(),
        isRecurring: joi_1.default.boolean().default(true),
        effectiveDate: joi_1.default.string().isoDate().allow(null).optional(),
        expiresAt: joi_1.default.string().isoDate().allow(null).optional(),
    }))
        .min(0)
        .max(168)
        .required(),
});
exports.findBestTimes = joi_1.default.object({
    durationMinutes: joi_1.default.number().integer().min(30).max(480).required(),
    minAttendees: joi_1.default.number().integer().min(1).max(500).required(),
});
//# sourceMappingURL=availabilitySchemas.js.map