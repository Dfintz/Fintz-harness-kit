import { Express, RequestHandler } from 'express';
import { RouteMetadata } from './decorators';
export type ControllerClass = new (...args: any[]) => any;
export interface RegisterOptions {
    prefix?: string;
    globalMiddleware?: RequestHandler[];
    debug?: boolean;
}
export interface RegisteredRoute {
    method: string;
    path: string;
    controller: string;
    handler: string;
}
export declare function registerControllers(app: Express, controllers: ControllerClass[], options?: RegisterOptions): RegisteredRoute[];
export declare function getControllerRoutes(ControllerClass: ControllerClass): RouteMetadata[];
export declare function getControllerBasePath(ControllerClass: ControllerClass): string;
//# sourceMappingURL=register.d.ts.map