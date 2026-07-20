import { Server as HttpServer } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { Express } from 'express';
import { GraphQLContext } from './context';
export { pubsub, SUBSCRIPTION_EVENTS } from './subscriptions';
export declare function setupGraphQLServer(app: Express, httpServer: HttpServer): Promise<ApolloServer<GraphQLContext>>;
//# sourceMappingURL=server.d.ts.map