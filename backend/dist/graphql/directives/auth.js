"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authDirective = authDirective;
const utils_1 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
function authDirective(directiveName) {
    const authDirectiveTypeDefs = `
    directive @${directiveName}(
      requires: String
    ) on FIELD_DEFINITION | OBJECT
  `;
    function authDirectiveTransformer(schema) {
        return (0, utils_1.mapSchema)(schema, {
            [utils_1.MapperKind.OBJECT_FIELD]: fieldConfig => {
                const authDirective = (0, utils_1.getDirective)(schema, fieldConfig, directiveName)?.[0];
                if (authDirective) {
                    const { resolve = graphql_1.defaultFieldResolver } = fieldConfig;
                    const requires = authDirective['requires'];
                    fieldConfig.resolve = async function (source, args, context, info) {
                        if (!context.user) {
                            throw new graphql_1.GraphQLError('You must be authenticated to access this resource', {
                                extensions: {
                                    code: 'UNAUTHENTICATED',
                                },
                            });
                        }
                        if (requires) {
                            const hasPermission = true;
                            if (!hasPermission) {
                                throw new graphql_1.GraphQLError(`You do not have permission to access this resource. Required: ${requires}`, {
                                    extensions: {
                                        code: 'FORBIDDEN',
                                    },
                                });
                            }
                        }
                        return resolve(source, args, context, info);
                    };
                    return fieldConfig;
                }
                return fieldConfig;
            },
        });
    }
    return {
        authDirectiveTypeDefs,
        authDirectiveTransformer,
    };
}
//# sourceMappingURL=auth.js.map