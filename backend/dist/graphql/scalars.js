"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UUIDScalar = exports.DateTimeScalar = void 0;
const graphql_1 = require("graphql");
exports.DateTimeScalar = new graphql_1.GraphQLScalarType({
    name: 'DateTime',
    description: 'ISO 8601 date-time string',
    serialize(value) {
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'string') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new TypeError(`DateTime cannot serialize invalid date: ${value}`);
            }
            return date.toISOString();
        }
        throw new TypeError(`DateTime cannot serialize value: ${value}`);
    },
    parseValue(value) {
        if (typeof value === 'string') {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new TypeError(`DateTime cannot parse invalid date: ${value}`);
            }
            return date;
        }
        if (value instanceof Date) {
            return value;
        }
        throw new TypeError(`DateTime cannot parse value: ${value}`);
    },
    parseLiteral(ast) {
        if (ast.kind === graphql_1.Kind.STRING) {
            const date = new Date(ast.value);
            if (isNaN(date.getTime())) {
                throw new TypeError(`DateTime cannot parse invalid date: ${ast.value}`);
            }
            return date;
        }
        throw new TypeError(`DateTime cannot parse literal of kind: ${ast.kind}`);
    },
});
exports.UUIDScalar = new graphql_1.GraphQLScalarType({
    name: 'UUID',
    description: 'UUID string',
    serialize(value) {
        if (typeof value === 'string') {
            if (!isValidUUID(value)) {
                throw new TypeError(`UUID cannot serialize invalid UUID: ${value}`);
            }
            return value;
        }
        throw new TypeError(`UUID cannot serialize value: ${value}`);
    },
    parseValue(value) {
        if (typeof value === 'string') {
            if (!isValidUUID(value)) {
                throw new TypeError(`UUID cannot parse invalid UUID: ${value}`);
            }
            return value;
        }
        throw new TypeError(`UUID cannot parse value: ${value}`);
    },
    parseLiteral(ast) {
        if (ast.kind === graphql_1.Kind.STRING) {
            if (!isValidUUID(ast.value)) {
                throw new TypeError(`UUID cannot parse invalid UUID: ${ast.value}`);
            }
            return ast.value;
        }
        throw new TypeError(`UUID cannot parse literal of kind: ${ast.kind}`);
    },
});
function isValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}
//# sourceMappingURL=scalars.js.map