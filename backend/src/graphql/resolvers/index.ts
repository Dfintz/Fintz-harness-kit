/**
 * GraphQL Resolvers
 *
 * Combined resolvers for all GraphQL types.
 *
 * @deprecated **STATUS: EXPERIMENTAL / PROTOTYPE — NOT FOR PRODUCTION USE.**
 *
 * Query and Mutation resolvers currently return stub/placeholder data and
 * are NOT wired to the service layer. Type resolvers (nested field
 * resolution via DataLoaders) are functional. Subscriptions use PubSub and
 * will work once mutations emit events.
 *
 * **Verified consumer audit (Phase 5):** No frontend, backend, or test code
 * relies on Query/Mutation resolver output. The frontend exclusively uses
 * the REST API (`/api/v2/*`) via `apiClient` + React Query. The smoke
 * tests at `tests/smoke-graphql.spec.ts` only verify reachability and
 * `__typename` introspection — they do not depend on stub data.
 *
 * To move to production:
 * 1. Wire Query resolvers to real service layer (e.g., FleetService, ShipService)
 * 2. Wire Mutation resolvers to real service layer with proper authorization
 * 3. Add input validation (reuse existing Joi schemas)
 * 4. Add error handling with GraphQL-specific error codes
 * 5. Emit subscription events from mutations
 *
 * Until then, callers should use the REST API. Do NOT add new consumers of
 * these resolvers.
 */

import { activityResolvers } from './activity';
import { fleetResolvers } from './fleet';
import { organizationResolvers } from './organization';
import { shipResolvers } from './ship';
import { userResolvers } from './user';

// Re-export types (avoiding duplicates by only exporting from activity which has all types)
export type {
  ActivityFilterInput,
  ActivitySortInput,
  CreateActivityInput,
  JoinActivityInput,
  PaginationInput,
  UpdateActivityInput,
} from './activity';
export type { CreateFleetInput, FleetSortInput, ShipFilterInput, UpdateFleetInput } from './fleet';
export type {
  CreateOrganizationInput,
  UpdateMemberRoleInput,
  UpdateOrganizationInput,
} from './organization';
export type { CreateShipInput, ShipSortInput, UpdateShipInput } from './ship';
export type { UpdateUserInput } from './user';

// Merge all resolvers
export const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...organizationResolvers.Query,
    ...fleetResolvers.Query,
    ...shipResolvers.Query,
    ...activityResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...organizationResolvers.Mutation,
    ...fleetResolvers.Mutation,
    ...shipResolvers.Mutation,
    ...activityResolvers.Mutation,
  },
  Subscription: {
    ...activityResolvers.Subscription,
    ...fleetResolvers.Subscription,
    ...organizationResolvers.Subscription,
  },
  // Type resolvers
  User: userResolvers.User,
  Organization: organizationResolvers.Organization,
  Fleet: fleetResolvers.Fleet,
  Ship: shipResolvers.Ship,
  Activity: activityResolvers.Activity,
};
