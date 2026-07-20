"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_EVENTS = exports.pubsub = void 0;
const graphql_subscriptions_1 = require("graphql-subscriptions");
exports.pubsub = new graphql_subscriptions_1.PubSub();
exports.SUBSCRIPTION_EVENTS = {
    ACTIVITY_UPDATED: 'ACTIVITY_UPDATED',
    PARTICIPANT_UPDATED: 'PARTICIPANT_UPDATED',
    FLEET_UPDATED: 'FLEET_UPDATED',
    FLEET_SHIP_CHANGED: 'FLEET_SHIP_CHANGED',
    MEMBER_CHANGED: 'MEMBER_CHANGED',
};
//# sourceMappingURL=subscriptions.js.map