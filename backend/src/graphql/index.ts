/**
 * GraphQL Module
 *
 * Main entry point for GraphQL functionality.
 *
 * **STATUS: EXPERIMENTAL / PROTOTYPE**
 *
 * The GraphQL layer is structurally complete (schema, resolvers, context,
 * DataLoaders, persisted queries, subscriptions) but Query/Mutation resolvers
 * return stub data. Type resolvers (DataLoader-based) are functional.
 * See resolvers/index.ts for details on wiring to real services.
 */

export { createContext } from './context';
export type { DataLoaders, GraphQLContext, User } from './context';
export * from './directives';
export { resolvers } from './resolvers';
export { DateTimeScalar, UUIDScalar } from './scalars';
export { pubsub, setupGraphQLServer, SUBSCRIPTION_EVENTS } from './server';
