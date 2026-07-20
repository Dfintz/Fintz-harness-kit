"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGraphQLInput = validateGraphQLInput;
exports.validateField = validateField;
exports.isNullOrUndefined = isNullOrUndefined;
exports.createObjectTypeGuard = createObjectTypeGuard;
exports.validateBatchArguments = validateBatchArguments;
exports.formatValidationError = formatValidationError;
const graphql_1 = require("graphql");
const logger_1 = require("../../utils/logger");
function validateGraphQLInput(data, schema, options) {
    try {
        const { error, value } = schema.validate(data, {
            abortEarly: options?.abortEarly ?? false,
            stripUnknown: true,
            convert: true,
        });
        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type,
            }));
            logger_1.logger.warn('GraphQL input validation failed', {
                context: options?.context || 'unknown',
                errorCount: details.length,
                fields: details.map(d => d.field),
            });
            throw new graphql_1.GraphQLError('Input validation failed', {
                extensions: {
                    code: 'VALIDATION_ERROR',
                    details,
                    statusCode: 400,
                },
            });
        }
        return value;
    }
    catch (err) {
        if (err instanceof graphql_1.GraphQLError) {
            throw err;
        }
        logger_1.logger.error('Unexpected validation error', {
            context: options?.context || 'unknown',
            error: err instanceof Error ? err.message : String(err),
        });
        throw new graphql_1.GraphQLError('Unexpected validation error', {
            extensions: {
                code: 'INTERNAL_SERVER_ERROR',
            },
        });
    }
}
function validateField(value, schema, fieldName) {
    const { error } = schema.validate(value, { abortEarly: true });
    if (error) {
        throw new graphql_1.GraphQLError(`Invalid ${fieldName}: ${error.message}`, {
            extensions: {
                code: 'VALIDATION_ERROR',
                field: fieldName,
                statusCode: 400,
            },
        });
    }
}
function isNullOrUndefined(value) {
    return value === null || value === undefined;
}
function createObjectTypeGuard(keys) {
    return (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return false;
        }
        const record = obj;
        return keys.every(key => key in record);
    };
}
function validateBatchArguments(args, data) {
    const validatedData = {};
    const errors = [];
    for (const [field, schema] of Object.entries(args)) {
        const value = data[field];
        const { error, value: validatedValue } = schema.validate(value, {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });
        if (error) {
            errors.push(...error.details.map(detail => ({
                field: `${field}.${detail.path.join('.')}`,
                message: detail.message,
                type: detail.type,
            })));
        }
        else {
            validatedData[field] = validatedValue;
        }
    }
    if (errors.length > 0) {
        logger_1.logger.warn('Batch validation failed', {
            errorCount: errors.length,
            fields: errors.map(e => e.field),
        });
        throw new graphql_1.GraphQLError('Input validation failed', {
            extensions: {
                code: 'VALIDATION_ERROR',
                details: errors,
                statusCode: 400,
            },
        });
    }
    return validatedData;
}
function formatValidationError(validationError) {
    return validationError.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
    }));
}
//# sourceMappingURL=inputValidators.js.map