"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasValidationErrors = exports.getValidationErrors = exports.setValidationErrors = void 0;
let validationErrors = [];
const setValidationErrors = (errors) => {
    validationErrors = errors;
};
exports.setValidationErrors = setValidationErrors;
const getValidationErrors = () => validationErrors;
exports.getValidationErrors = getValidationErrors;
const hasValidationErrors = () => validationErrors.length > 0;
exports.hasValidationErrors = hasValidationErrors;
//# sourceMappingURL=validationState.js.map