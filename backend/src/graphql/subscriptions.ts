/**
 * GraphQL Subscriptions Configuration
 * 
 * Central location for PubSub instance and subscription event constants.
 * Extracted to avoid circular dependencies between server and resolvers.
 */

import { PubSub } from 'graphql-subscriptions';

/**
 * PubSub instance for GraphQL subscriptions
 * Used by resolvers to publish events and by subscriptions to listen for them
 */
export const pubsub = new PubSub();

/**
 * Subscription event constants
 * Defines all available subscription events in the GraphQL API
 */
export const SUBSCRIPTION_EVENTS = {
  ACTIVITY_UPDATED: 'ACTIVITY_UPDATED',
  PARTICIPANT_UPDATED: 'PARTICIPANT_UPDATED',
  FLEET_UPDATED: 'FLEET_UPDATED',
  FLEET_SHIP_CHANGED: 'FLEET_SHIP_CHANGED',
  MEMBER_CHANGED: 'MEMBER_CHANGED',
} as const;
