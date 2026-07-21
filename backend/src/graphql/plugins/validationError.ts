/**
 * GraphQL Validation Error Plugin
 *
 * Apollo Server plugin for handling and logging GraphQL validation errors
 * Provides centralized error formatting and observability
 */

import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';

import { logger } from '../../utils/logger';

/**
 * Validation error plugin
 * Catches and logs validation errors from resolvers
 */
export function createValidationErrorPlugin(): ApolloServerPlugin<BaseContext> {
  return {
    async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
      return {
        async didEncounterErrors(
          requestContext: GraphQLRequestContext<BaseContext>
        ): Promise<void> {
          const { errors, request } = requestContext;

          if (!errors || errors.length === 0) {
            return;
          }

          // Filter for validation errors
          const validationErrors = errors.filter((e: unknown) => {
            const error = e as Record<string, unknown>;
            return (
              error?.extensions &&
              typeof error.extensions === 'object' &&
              (error.extensions as Record<string, unknown>)?.code === 'VALIDATION_ERROR'
            );
          });

          if (validationErrors.length === 0) {
            return;
          }

          // Log validation errors with context for observability
          const errorDetails = validationErrors.map((error: unknown) => {
            const err = error as Record<string, unknown>;
            const extensions = err?.extensions as Record<string, unknown>;
            return {
              message: typeof err?.message === 'string' ? err.message : String(err?.message),
              path: Array.isArray(err?.path) ? (err.path as string[]).join('.') : 'root',
              details: extensions?.details,
              statusCode: extensions?.statusCode,
            };
          });

          logger.info('GraphQL validation errors', {
            operationName: request.operationName,
            errorCount: validationErrors.length,
            errors: errorDetails,
            query: request.query?.substring(0, 100), // First 100 chars for context
          });
        },
      };
    },
  };
}

export const validationErrorPlugin: ApolloServerPlugin<BaseContext> = createValidationErrorPlugin();
