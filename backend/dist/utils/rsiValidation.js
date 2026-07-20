"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRsiIdentifier = validateRsiIdentifier;
const apiErrors_1 = require("./apiErrors");
const RSI_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]+$/;
function validateRsiIdentifier(value, label) {
    if (!value || !RSI_IDENTIFIER_PATTERN.test(value)) {
        throw new apiErrors_1.ValidationError(`Invalid RSI ${label}: contains disallowed characters`);
    }
}
//# sourceMappingURL=rsiValidation.js.map