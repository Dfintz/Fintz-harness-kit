import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';
export declare const TOKENS: {
    readonly DATA_SOURCE: "DataSource";
    readonly FLEET_REPOSITORY: "FleetRepository";
    readonly USER_REPOSITORY: "UserRepository";
    readonly ORGANIZATION_REPOSITORY: "OrganizationRepository";
    readonly SHIP_REPOSITORY: "ShipRepository";
    readonly ACTIVITY_REPOSITORY: "ActivityRepository";
    readonly LOGGER: "Logger";
    readonly CACHE_SERVICE: "CacheService";
    readonly FLEET_SERVICE: "FleetService";
    readonly USER_SERVICE: "UserService";
    readonly ORGANIZATION_SERVICE: "OrganizationService";
    readonly ACTIVITY_SERVICE: "ActivityService";
    readonly SHIP_SERVICE: "ShipService";
};
export declare function registerDatabaseDependencies(): void;
export declare function initializeContainer(): DependencyContainer;
export declare function getContainer(): DependencyContainer;
export declare function resolve<T>(token: string): T;
export { container };
//# sourceMappingURL=index.d.ts.map