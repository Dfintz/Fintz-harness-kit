/**
 * Rate Limit Directive
 *
 * Limits the rate of requests for fields marked with @rateLimit
 */

import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLError, GraphQLResolveInfo, GraphQLSchema } from 'graphql';

import { GraphQLContext } from '../context';

// Simple in-memory rate limiter (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimitDirective(directiveName: string) {
  const rateLimitDirectiveTypeDefs = `
    directive @${directiveName}(
      """Maximum number of requests allowed"""
      limit: Int! = 100
      
      """Time window in seconds"""
      window: Int! = 60
    ) on FIELD_DEFINITION
  `;

  function rateLimitDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
    return mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
        const rateLimitDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

        if (rateLimitDirective) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          const limit = rateLimitDirective['limit'] as number;
          const windowSeconds = rateLimitDirective['window'] as number;

          fieldConfig.resolve = async function (
            source: unknown,
            args: Record<string, unknown>,
            context: GraphQLContext,
            info: GraphQLResolveInfo
          ) {
            // Get identifier (user ID or IP)
            const identifier = context.user?.id || context.req?.ip || 'anonymous';
            const key = `${identifier}:${fieldName}`;
            const now = Date.now();

            // Get or create rate limit entry
            let entry = rateLimitStore.get(key);

            if (!entry || now > entry.resetTime) {
              // Reset the window
              entry = {
                count: 0,
                resetTime: now + windowSeconds * 1000,
              };
            }

            // Check limit
            if (entry.count >= limit) {
              const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
              throw new GraphQLError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, {
                extensions: {
                  code: 'RATE_LIMITED',
                  retryAfter,
                },
              });
            }

            // Increment count
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
