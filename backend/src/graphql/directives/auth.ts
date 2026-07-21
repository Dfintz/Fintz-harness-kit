/**
 * Auth Directive
 *
 * Requires authentication for fields/types marked with @auth
 */

import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLError, GraphQLResolveInfo, GraphQLSchema } from 'graphql';

import { GraphQLContext } from '../context';

export function authDirective(directiveName: string) {
  const authDirectiveTypeDefs = `
    directive @${directiveName}(
      requires: String
    ) on FIELD_DEFINITION | OBJECT
  `;

  function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
    return mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: fieldConfig => {
        const authDirective = getDirective(schema, fieldConfig, directiveName)?.[0];

        if (authDirective) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          const requires = authDirective['requires'] as string | undefined;

          fieldConfig.resolve = async function (
            source: unknown,
            args: Record<string, unknown>,
            context: GraphQLContext,
            info: GraphQLResolveInfo
          ) {
            // Check authentication
            if (!context.user) {
              throw new GraphQLError('You must be authenticated to access this resource', {
                extensions: {
                  code: 'UNAUTHENTICATED',
                },
              });
            }

            // Check authorization if role is required
            if (requires) {
              // Placeholder for role checking
              // This would check if user has required role/permission
              const hasPermission = true; // Replace with actual check

              if (!hasPermission) {
                throw new GraphQLError(
                  `You do not have permission to access this resource. Required: ${requires}`,
                  {
                    extensions: {
                      code: 'FORBIDDEN',
                    },
                  }
                );
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
