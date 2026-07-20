"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DATALOADER_OPTIONS = void 0;
exports.createDataLoaders = createDataLoaders;
exports.createDataLoadersWithPriming = createDataLoadersWithPriming;
const activityLoaders_1 = require("./activityLoaders");
const fleetLoaders_1 = require("./fleetLoaders");
const organizationLoaders_1 = require("./organizationLoaders");
const shipLoaders_1 = require("./shipLoaders");
const types_1 = require("./types");
const userLoaders_1 = require("./userLoaders");
var types_2 = require("./types");
Object.defineProperty(exports, "DEFAULT_DATALOADER_OPTIONS", { enumerable: true, get: function () { return types_2.DEFAULT_DATALOADER_OPTIONS; } });
function createDataLoaders(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    return {
        userById: (0, userLoaders_1.createUserByIdLoader)(options),
        organizationById: (0, organizationLoaders_1.createOrganizationByIdLoader)(options),
        fleetById: (0, fleetLoaders_1.createFleetByIdLoader)(options),
        shipById: (0, shipLoaders_1.createShipByIdLoader)(options),
        activityById: (0, activityLoaders_1.createActivityByIdLoader)(options),
        usersByOrganizationId: (0, userLoaders_1.createUsersByOrganizationIdLoader)(options),
        organizationsByUserId: (0, organizationLoaders_1.createOrganizationsByUserIdLoader)(options),
        fleetsByOrganizationId: (0, fleetLoaders_1.createFleetsByOrganizationIdLoader)(options),
        fleetsByLeaderId: (0, fleetLoaders_1.createFleetsByLeaderIdLoader)(options),
        shipsByUserId: (0, shipLoaders_1.createShipsByUserIdLoader)(options),
        shipsByOrganizationId: (0, shipLoaders_1.createShipsByOrganizationIdLoader)(options),
        shipsByFleetId: (0, shipLoaders_1.createShipsByFleetIdLoader)(options),
        activitiesByOrganizationId: (0, activityLoaders_1.createActivitiesByOrganizationIdLoader)(options),
        activitiesByUserId: (0, activityLoaders_1.createActivitiesByUserIdLoader)(options),
    };
}
function createDataLoadersWithPriming(options = types_1.DEFAULT_DATALOADER_OPTIONS) {
    const loaders = createDataLoaders(options);
    return {
        loaders,
        prime: {
            users: users => {
                users.forEach(user => {
                    loaders.userById.prime(user.id, user);
                });
            },
            organizations: orgs => {
                orgs.forEach(org => {
                    loaders.organizationById.prime(org.id, org);
                });
            },
            fleets: fleets => {
                fleets.forEach(fleet => {
                    loaders.fleetById.prime(fleet.id, fleet);
                });
            },
            ships: ships => {
                ships.forEach(ship => {
                    loaders.shipById.prime(ship.id, ship);
                });
            },
            activities: activities => {
                activities.forEach(activity => {
                    loaders.activityById.prime(activity.id, activity);
                });
            },
        },
    };
}
//# sourceMappingURL=index.js.map