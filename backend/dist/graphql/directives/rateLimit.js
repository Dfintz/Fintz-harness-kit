"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitDirective = rateLimitDirective;
const utils_1 = require("@graphql-tools/utils");
const graphql_1 = require("graphql");
const rateLimitStore = new Map();
function rateLimitDirective(directiveName) {
    const rateLimitDirectiveTypeDefs = `
    directive @${directiveName}(
      """Maximum number of requests allowed"""
      limit: Int! = 100
      
      """Time window in seconds"""
      window: Int! = 60
    ) on FIELD_DEFINITION
  `;
    function rateLimitDirectiveTransformer(schema) {
        return (0, utils_1.mapSchema)(schema, {
            [utils_1.MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
                const rateLimitDirective = (0, utils_1.getDirective)(schema, fieldConfig, directiveName)?.[0];
                if (rateLimitDirective) {
                    const { resolve = graphql_1.defaultFieldResolver } = fieldConfig;
                    const limit = rateLimitDirective['limit'];
                    const windowSeconds = rateLimitDirective['window'];
                    fieldConfig.resolve = async function (source, args, context, info) {
                        const identifier = context.user?.id || context.req?.ip || 'anonymous';
                        const key = `${identifier}:${fieldName}`;
                        const now = Date.now();
                        let entry = rateLimitStore.get(key);
                        if (!entry || now > entry.resetTime) {
                            entry = {
                                count: 0,
                                resetTime: now + windowSeconds * 1000,
                            };
                        }
                        if (entry.count >= limit) {
                            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
                            throw new graphql_1.GraphQLError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, {
                                extensions: {
                                    code: 'RATE_LIMITED',
                                    retryAfter,
                                },
                            });
                        }
                        entry.count++;
                        rateLimitStore.set(key, entry);
                        return resolve(source, args, context, info);
                    };
                    return fieldConfig;
                }
                return fieldConfig;
            },
        });
    }
    return {
        rateLimitDirectiveTypeDefs,
        rateLimitDirectiveTransformer,
    };
}
//# sourceMappingURL=rateLimit.js.map