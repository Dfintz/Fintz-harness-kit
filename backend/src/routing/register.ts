/**
 * Route Registration System
 * 
 * Automatic route registration from decorated controller classes.
 * Integrates with Express and the DI container.
 * 
 * @module routing/register
 */

import { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { container } from 'tsyringe';

import { logger } from '../utils/logger';

import { CONTROLLER_KEY, ROUTES_KEY, RouteMetadata } from './decorators';

/**
 * Controller class type for type safety
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControllerClass = new (...args: any[]) => any;

/**
 * Options for route registration
 */
export interface RegisterOptions {
  /** Base path prefix for all routes */
  prefix?: string;
  /** Global middleware to apply to all routes */
  globalMiddleware?: RequestHandler[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Registered route information for logging/debugging
 */
export interface RegisteredRoute {
  method: string;
  path: string;
  controller: string;
  handler: string;
}

/**
 * Wraps an async route handler to catch errors
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function asyncHandler(fn: Function): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Register a single controller with Express
 */
function registerController(
  app: Express,
  ControllerClass: ControllerClass,
  options: RegisterOptions = {}
): RegisteredRoute[] {
  const { prefix = '', globalMiddleware = [], debug = false } = options;
  const registeredRoutes: RegisteredRoute[] = [];
  
  // Get controller metadata
  const basePath = Reflect.getMetadata(CONTROLLER_KEY, ControllerClass) || '';
  const routes: RouteMetadata[] = Reflect.getMetadata(ROUTES_KEY, ControllerClass) || [];
  
  if (routes.length === 0) {
    logger.warn(`Controller ${ControllerClass.name} has no routes defined`);
    return registeredRoutes;
  }
  
  // Resolve controller instance from DI container
  let controllerInstance: Record<string, unknown>;
  try {
    controllerInstance = container.resolve(ControllerClass);
  } catch (_error) {
    // If not registered in container, create instance directly
    controllerInstance = new ControllerClass();
  }
  
  // Register each route
  for (const route of routes) {
    const fullPath = `${prefix}${basePath}${route.path}`;
    const handler = (controllerInstance[route.handlerName] as (...args: unknown[]) => unknown).bind(controllerInstance);
    
    // Combine global middleware with route-specific middleware
    const middleware: RequestHandler[] = [
      ...globalMiddleware,
      ...(route.middleware as RequestHandler[]),
    ];
    
    // Register route with Express
    const expressMethod = app[route.method].bind(app);
    expressMethod(fullPath, ...middleware, asyncHandler(handler));
    
    registeredRoutes.push({
      method: route.method.toUpperCase(),
      path: fullPath,
      controller: ControllerClass.name,
      handler: route.handlerName,
    });
    
    if (debug) {
      logger.debug(`Registered route: ${route.method.toUpperCase()} ${fullPath} -> ${ControllerClass.name}.${route.handlerName}`);
    }
  }
  
  return registeredRoutes;
}

/**
 * Register multiple controllers with Express
 * 
 * @param app - Express application
 * @param controllers - Array of controller classes
 * @param options - Registration options
 * @returns Array of registered routes
 * 
 * @example
 * ```typescript
 * const routes = registerControllers(app, [
 *   FleetController,
 *   UserController,
 *   OrganizationController,
 * ], {
 *   prefix: '/api/v2',
 *   debug: true,
 * });
 * ```
 */
export function registerControllers(
  app: Express,
  controllers: ControllerClass[],
  options: RegisterOptions = {}
): RegisteredRoute[] {
  const allRoutes: RegisteredRoute[] = [];
  
  for (const controller of controllers) {
    const routes = registerController(app, controller, options);
    allRoutes.push(...routes);
  }
  
  logger.info(`Registered ${allRoutes.length} routes from ${controllers.length} controllers`);
  
  return allRoutes;
}

/**
 * Get route metadata from a controller class (for testing/debugging)
 */
export function getControllerRoutes(ControllerClass: ControllerClass): RouteMetadata[] {
  return Reflect.getMetadata(ROUTES_KEY, ControllerClass) || [];
}

/**
 * Get base path from a controller class (for testing/debugging)
 */
export function getControllerBasePath(ControllerClass: ControllerClass): string {
  return Reflect.getMetadata(CONTROLLER_KEY, ControllerClass) || '';
}
