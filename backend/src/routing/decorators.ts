/**
 * Route Registration Decorators
 * 
 * Decorators for automatic route registration with Express.
 * These decorators allow defining routes using class methods with metadata.
 * 
 * @module routing/decorators
 */

/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import 'reflect-metadata';

// Metadata keys for route information
export const CONTROLLER_KEY = 'controller:path';
export const ROUTES_KEY = 'controller:routes';
export const MIDDLEWARE_KEY = 'route:middleware';

/**
 * HTTP Methods supported by the routing system
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * Route metadata stored for each route handler
 */
export interface RouteMetadata {
  method: HttpMethod;
  path: string;
  handlerName: string;
  middleware: Function[];
}

/**
 * Controller decorator - marks a class as a route controller
 * @param basePath - Base path for all routes in the controller
 */
export function Controller(basePath: string = ''): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata(CONTROLLER_KEY, basePath, target);
    
    // Ensure routes array exists
    if (!Reflect.hasMetadata(ROUTES_KEY, target)) {
      Reflect.defineMetadata(ROUTES_KEY, [], target);
    }
  };
}

/**
 * Creates a route method decorator
 */
function createRouteDecorator(method: HttpMethod) {
  return function (path: string = ''): MethodDecorator {
    return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const controllerClass = target.constructor;
      
      // Get existing routes or create new array
      const routes: RouteMetadata[] = Reflect.getMetadata(ROUTES_KEY, controllerClass) || [];
      
      // Get middleware for this route
      const middleware: Function[] = Reflect.getMetadata(MIDDLEWARE_KEY, target, propertyKey) || [];
      
      // Add route metadata
      routes.push({
        method,
        path,
        handlerName: propertyKey as string,
        middleware,
      });
      
      Reflect.defineMetadata(ROUTES_KEY, routes, controllerClass);
      
      return descriptor;
    };
  };
}

/**
 * HTTP Method Decorators
 */
export const Get = createRouteDecorator('get');
export const Post = createRouteDecorator('post');
export const Put = createRouteDecorator('put');
export const Patch = createRouteDecorator('patch');
export const Delete = createRouteDecorator('delete');

/**
 * Middleware decorator - adds middleware to a route
 * @param middleware - Middleware functions to apply
 */
export function UseMiddleware(...middleware: Function[]): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const existingMiddleware: Function[] = Reflect.getMetadata(MIDDLEWARE_KEY, target, propertyKey) || [];
    Reflect.defineMetadata(MIDDLEWARE_KEY, [...existingMiddleware, ...middleware], target, propertyKey);
    return descriptor;
  };
}

/**
 * Class decorator to add middleware to all routes in a controller
 * @param middleware - Middleware functions to apply
 */
export function UseControllerMiddleware(...middleware: Function[]): ClassDecorator {
  return function (target: Function) {
    const routes: RouteMetadata[] = Reflect.getMetadata(ROUTES_KEY, target) || [];
    
    // Add middleware to all existing routes
    routes.forEach(route => {
      route.middleware = [...middleware, ...route.middleware];
    });
    
    Reflect.defineMetadata(ROUTES_KEY, routes, target);
  };
}

/**
 * Authenticate decorator - adds authentication middleware to a route
 * Uses the standard authenticateToken middleware from auth.ts
 */
export function Authenticate(): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Lazy load to avoid circular dependencies
    // Note: This uses require() for runtime loading, which is necessary to avoid
    // circular dependency issues between decorators and middleware modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { authenticateToken } = require('../middleware/auth');
    return UseMiddleware(authenticateToken)(target, propertyKey, descriptor);
  };
}

/**
 * ValidateBody decorator - adds body validation middleware to a route
 * @param schema - Joi schema for request body validation
 */
export function ValidateBody(schema: unknown): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Lazy load to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateSchema } = require('../middleware/schemaValidation');
    return UseMiddleware(validateSchema(schema, 'body'))(target, propertyKey, descriptor);
  };
}

/**
 * ValidateQuery decorator - adds query validation middleware to a route
 * @param schema - Joi schema for query parameters validation
 */
export function ValidateQuery(schema: unknown): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Lazy load to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateSchema } = require('../middleware/schemaValidation');
    return UseMiddleware(validateSchema(schema, 'query'))(target, propertyKey, descriptor);
  };
}

/**
 * ValidateParams decorator - adds params validation middleware to a route
 * @param schema - Joi schema for route params validation
 */
export function ValidateParams(schema: unknown): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Lazy load to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validateSchema } = require('../middleware/schemaValidation');
    return UseMiddleware(validateSchema(schema, 'params'))(target, propertyKey, descriptor);
  };
}
