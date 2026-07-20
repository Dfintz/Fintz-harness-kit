"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_EVENTS = exports.pubsub = void 0;
exports.setupGraphQLServer = setupGraphQLServer;
const node_path_1 = __importDefault(require("node:path"));
const server_1 = require("@apollo/server");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const express4_1 = require("@as-integrations/express4");
const load_files_1 = require("@graphql-tools/load-files");
const merge_1 = require("@graphql-tools/merge");
const schema_1 = require("@graphql-tools/schema");
const graphql_depth_limit_1 = __importDefault(require("graphql-depth-limit"));
const ws_1 = require("graphql-ws/lib/use/ws");
const ws_2 = require("ws");
const csrf_1 = require("../middleware/csrf");
const logger_1 = require("../utils/logger");
const context_1 = require("./context");
const auth_1 = require("./directives/auth");
const rateLimit_1 = require("./directives/rateLimit");
const plugins_1 = require("./plugins");
const resolvers_1 = require("./resolvers");
const scalars_1 = require("./scalars");
var subscriptions_1 = require("./subscriptions");
Object.defineProperty(exports, "pubsub", { enumerable: true, get: function () { return subscriptions_1.pubsub; } });
Object.defineProperty(exports, "SUBSCRIPTION_EVENTS", { enumerable: true, get: function () { return subscriptions_1.SUBSCRIPTION_EVENTS; } });
function loadTypeDefs() {
    const typesArray = (0, load_files_1.loadFilesSync)(node_path_1.default.join(__dirname, 'schema', '*.graphql'), {
        extensions: ['graphql'],
    });
    return (0, merge_1.mergeTypeDefs)(typesArray);
}
function createSchema() {
    const typeDefs = loadTypeDefs();
    const { authDirectiveTypeDefs, authDirectiveTransformer } = (0, auth_1.authDirective)('auth');
    const { rateLimitDirectiveTypeDefs, rateLimitDirectiveTransformer } = (0, rateLimit_1.rateLimitDirective)('rateLimit');
    let schema = (0, schema_1.makeExecutableSchema)({
        typeDefs: [typeDefs, authDirectiveTypeDefs, rateLimitDirectiveTypeDefs],
        resolvers: {
            ...resolvers_1.resolvers,
            DateTime: scalars_1.DateTimeScalar,
            UUID: scalars_1.UUIDScalar,
        },
    });
    schema = authDirectiveTransformer(schema);
    schema = rateLimitDirectiveTransformer(schema);
    return schema;
}
async function setupGraphQLServer(app, httpServer) {
    logger_1.logger.warn('GraphQL server starting in EXPERIMENTAL mode — Query/Mutation resolvers return stub data. ' +
        'Use REST API (/api/v2/*) for production traffic.');
    const schema = createSchema();
    const wsServer = new ws_2.WebSocketServer({
        server: httpServer,
        path: '/graphql',
    });
    const serverCleanup = (0, ws_1.useServer)({
        schema,
        context: ctx => {
            const token = ctx.connectionParams?.authorization;
            return (0, context_1.createContext)({ token });
        },
        onConnect: _ctx => {
            logger_1.logger.debug('GraphQL subscription client connected');
            return true;
        },
        onDisconnect: () => {
            logger_1.logger.debug('GraphQL subscription client disconnected');
        },
    }, wsServer);
    const isDev = process.env.NODE_ENV !== 'production';
    const GRAPHQL_MAX_DEPTH = 10;
    const server = new server_1.ApolloServer({
        schema,
        validationRules: [(0, graphql_depth_limit_1.default)(GRAPHQL_MAX_DEPTH)],
        includeStacktraceInErrorResponses: isDev,
        plugins: [
            (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
            {
                serverWillStart() {
                    return Promise.resolve({
                        async drainServer() {
                            await serverCleanup.dispose();
                        },
                    });
                },
            },
            plugins_1.queryComplexityPlugin,
            plugins_1.validationErrorPlugin,
            plugins_1.persistedQueriesPlugin,
        ],
        formatError: error => {
            logger_1.logger.error('GraphQL Error:', {
                message: error.message,
                code: error.extensions?.code,
                path: error.path,
                stack: isDev ? error.extensions?.stacktrace : undefined,
            });
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
    await server.start();
    app.use('/graphql', (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return next();
        }
        return csrf_1.csrfProtection.validate(req, res, next);
    });
    app.use('/graphql', (0, express4_1.expressMiddleware)(server, {
        context: async ({ req, res }) => (0, context_1.createContext)({ req, res }),
    }));
    logger_1.logger.info('🚀 GraphQL server ready at /graphql');
    logger_1.logger.info('  ↳ Query complexity limit: 1000');
    logger_1.logger.info(`  ↳ Max query depth: ${GRAPHQL_MAX_DEPTH}`);
    return server;
}
//# sourceMappingURL=server.js.map