"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const activity_1 = require("./activity");
const fleet_1 = require("./fleet");
const organization_1 = require("./organization");
const ship_1 = require("./ship");
const user_1 = require("./user");
exports.resolvers = {
    Query: {
        ...user_1.userResolvers.Query,
        ...organization_1.organizationResolvers.Query,
        ...fleet_1.fleetResolvers.Query,
        ...ship_1.shipResolvers.Query,
        ...activity_1.activityResolvers.Query,
    },
    Mutation: {
        ...user_1.userResolvers.Mutation,
        ...organization_1.organizationResolvers.Mutation,
        ...fleet_1.fleetResolvers.Mutation,
        ...ship_1.shipResolvers.Mutation,
        ...activity_1.activityResolvers.Mutation,
    },
    Subscription: {
        ...activity_1.activityResolvers.Subscription,
        ...fleet_1.fleetResolvers.Subscription,
        ...organization_1.organizationResolvers.Subscription,
    },
    User: user_1.userResolvers.User,
    Organization: organization_1.organizationResolvers.Organization,
    Fleet: fleet_1.fleetResolvers.Fleet,
    Ship: ship_1.shipResolvers.Ship,
    Activity: activity_1.activityResolvers.Activity,
};
//# sourceMappingURL=index.js.map