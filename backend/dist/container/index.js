"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = exports.TOKENS = void 0;
exports.registerDatabaseDependencies = registerDatabaseDependencies;
exports.initializeContainer = initializeContainer;
exports.getContainer = getContainer;
exports.resolve = resolve;
require("reflect-metadata");
const tsyringe_1 = require("tsyringe");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return tsyringe_1.container; } });
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
exports.TOKENS = {
    DATA_SOURCE: 'DataSource',
    FLEET_REPOSITORY: 'FleetRepository',
    USER_REPOSITORY: 'UserRepository',
    ORGANIZATION_REPOSITORY: 'OrganizationRepository',
    SHIP_REPOSITORY: 'ShipRepository',
    ACTIVITY_REPOSITORY: 'ActivityRepository',
    LOGGER: 'Logger',
    CACHE_SERVICE: 'CacheService',
    FLEET_SERVICE: 'FleetService',
    USER_SERVICE: 'UserService',
    ORGANIZATION_SERVICE: 'OrganizationService',
    ACTIVITY_SERVICE: 'ActivityService',
    SHIP_SERVICE: 'ShipService',
};
function registerCoreDependencies(container) {
    container.register(exports.TOKENS.LOGGER, {
        useValue: logger_1.logger
    });
    logger_1.logger.info('Core dependencies registered');
}
function registerDatabaseDependencies() {
    if (!database_1.AppDataSource.isInitialized) {
        logger_1.logger.warn('Cannot register database dependencies - DataSource not initialized');
        return;
    }
    tsyringe_1.container.register(exports.TOKENS.DATA_SOURCE, {
        useValue: database_1.AppDataSource
    });
    logger_1.logger.info('Database dependencies registered');
}
function initializeContainer() {
    registerCoreDependencies(tsyringe_1.container);
    return tsyringe_1.container;
}
function getContainer() {
    return tsyringe_1.container;
}
function resolve(token) {
    return tsyringe_1.container.resolve(token);
}
//# sourceMappingURL=index.js.map