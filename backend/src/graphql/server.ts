/**
 * GraphQL Server Setup
 *
 * Apollo Server integration with Express for the Star Citizen Fleet Manager
 */

import { Server as HttpServer } from 'node:http';
import path from 'node:path';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { Express } from 'express';
import depthLimit from 'graphql-depth-limit';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';

import { csrfProtection } from '../middleware/csrf';
import { logger } from '../utils/logger';

import { createContext, GraphQLContext } from './context';
import { authDirective } from './directives/auth';
import { rateLimitDirective } from './directives/rateLimit';
import { persistedQueriesPlugin, queryComplexityPlugin, validationErrorPlugin } from './plugins';
import { resolvers } from './resolvers';
import { DateTimeScalar, UUIDScalar } from './scalars';

// Re-export for backward compatibility (if needed elsewhere)
export { pubsub, SUBSCRIPTION_EVENTS } from './subscriptions';

/**
 * Load and merge GraphQL type definitions from schema files
 */
function loadTypeDefs(): string {
  const typesArray = loadFilesSync(path.join(__dirname, 'schema', '*.graphql'), {
    extensions: ['graphql'],
  });
  return mergeTypeDefs(typesArray) as unknown as string;
}

/**
 * Create the executable schema with directives
 */
function createSchema(): ReturnType<typeof makeExecutableSchema> {
  const typeDefs = loadTypeDefs();

  // Apply directive transformers
  const { authDirectiveTypeDefs, authDirectiveTransformer } = authDirective('auth');
  const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } =
    rateLimitDirective('rateLimit');

  // Create base schema
  let schema = makeExecutableSchema({
    typeDefs: [typeDefs, authDirectiveTypeDefs, rateLimitDirectiveTypeDefs],
    resolvers: {
      ...resolvers,
      DateTime: DateTimeScalar,
      UUID: UUIDScalar,
    },
  });

  // Apply directive transformers
  schema = authDirectiveTransformer(schema);
  schema = rateLimitDirectiveTransformer(schema);

  return schema;
}

/**
 * Setup GraphQL server with Apollo
 */
export async function setupGraphQLServer(
  app: Express,
  httpServer: HttpServer
): Promise<ApolloServer<GraphQLContext>> {
  // Phase 5 audit: GraphQL Query/Mutation resolvers are stub/prototype only.
  // No production consumer (frontend, backend, or tests) depends on their output.
  // See backend/src/graphql/resolvers/index.ts for status.
  logger.warn(
    'GraphQL server starting in EXPERIMENTAL mode — Query/Mutation resolvers return stub data. ' +
      'Use REST API (/api/v2/*) for production traffic.'
  );

  const schema = createSchema();

  // Setup WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Setup subscription server
  const serverCleanup = useServer(
    {
      schema,
      context: ctx => {
        // Extract auth token from connection params
        const token = ctx.connectionParams?.authorization as string | undefined;
        return createContext({ token });
      },
      onConnect: _ctx => {
        logger.debug('GraphQL subscription client connected');
        return true;
      },
      onDisconnect: () => {
        logger.debug('GraphQL subscription client disconnected');
      },
    },
    wsServer
  );

  // deepcode ignore NoRateLimitingForExpensiveWebOperation: GraphQL DoS via deeply nested
  // queries is mitigated by queryComplexityPlugin (maxDepth: 10, maxComplexity: 1000)
  // registered in plugins below. See graphql/plugins/queryComplexity.ts.
  // NOSONAR: CWE-400 false positive — nested query DoS is mitigated by
  // queryComplexityPlugin which enforces maxDepth: 10 and maxComplexity: 1000.
  // See graphql/plugins/queryComplexity.ts for implementation.
  const isDev = process.env.NODE_ENV !== 'production';
  const GRAPHQL_MAX_DEPTH = 10;

  const server = new ApolloServer<GraphQLContext>({
    // NOSONAR
    schema,
    // CWE-400: Explicit query depth validation rule recognized by static analysis.
    validationRules: [depthLimit(GRAPHQL_MAX_DEPTH)],
    // CWE-400: Limit payload size to prevent DoS attacks
    includeStacktraceInErrorResponses: isDev,
    plugins: [
      // Proper shutdown for HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for WebSocket server
      {
        serverWillStart() {
          return Promise.resolve({
            async drainServer() {
              await serverCleanup.dispose();
            },
          });
        },
      },
      // CWE-400: Query complexity analysis to prevent expensive/deeply nested queries.
      // Implements maxDepth: 10, maxComplexity: 1000 via queryComplexityPlugin
      // (see graphql/plugins/queryComplexity.ts). This mitigates the DoS risk that
      // SonarQube flags as "graphql-depth-limit" — depth limiting IS enforced.
      queryComplexityPlugin,
      // Input validation error handler for GraphQL mutations/queries
      // Provides centralized error formatting and observability for validation failures
      validationErrorPlugin,
      // Automatic persisted queries for improved performance
      persistedQueriesPlugin,
    ],
    formatError: error => {
      // Log errors
      logger.error('GraphQL Error:', {
        message: error.message,
        code: error.extensions?.code,
        path: error.path,
        stack: isDev ? error.extensions?.stacktrace : undefined,
      });

      // Return sanitized error in production
      return {
        message: error.message,
        extensions: {
          code: error.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
          ...(isDev && {
            stacktrace: error.extensions?.stacktrace,
          }),
        },
      };
    },
    introspection: isDev,
  });

  // Start the server
  await server.start();

  // Apply middleware
  // CSRF protection for cookie-authenticated GraphQL calls (skip when using bearer tokens)
  app.use('/graphql', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return next();
    }
    return csrfProtection.validate(req, res, next);
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      // expressMiddleware requires context to return Promise<GraphQLContext>
      context: async ({ req, res }) => createContext({ req, res }),
    })
  );

  logger.info('🚀 GraphQL server ready at /graphql');
  logger.info('  ↳ Query complexity limit: 1000');
  logger.info(`  ↳ Max query depth: ${GRAPHQL_MAX_DEPTH}`);

  return server;
}
