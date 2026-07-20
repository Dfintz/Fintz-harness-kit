"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationErrorPlugin = void 0;
exports.createValidationErrorPlugin = createValidationErrorPlugin;
const logger_1 = require("../../utils/logger");
function createValidationErrorPlugin() {
    return {
        async requestDidStart() {
            return {
                async didEncounterErrors(requestContext) {
                    const { errors, request } = requestContext;
                    if (!errors || errors.length === 0) {
                        return;
                    }
                    const validationErrors = errors.filter((e) => {
                        const error = e;
                        return (error?.extensions &&
                            typeof error.extensions === 'object' &&
                            error.extensions?.code === 'VALIDATION_ERROR');
                    });
                    if (validationErrors.length === 0) {
                        return;
                    }
                    const errorDetails = validationErrors.map((error) => {
                        const err = error;
                        const extensions = err?.extensions;
                        return {
                            message: typeof err?.message === 'string' ? err.message : String(err?.message),
                            path: Array.isArray(err?.path) ? err.path.join('.') : 'root',
                            details: extensions?.details,
                            statusCode: extensions?.statusCode,
                        };
                    });
                    logger_1.logger.info('GraphQL validation errors', {
                        operationName: request.operationName,
                        errorCount: validationErrors.length,
                        errors: errorDetails,
                        query: request.query?.substring(0, 100),
                    });
                },
            };
        },
    };
}
exports.validationErrorPlugin = createValidationErrorPlugin();
//# sourceMappingURL=validationError.js.map