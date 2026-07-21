/**
 * Routing Module
 * 
 * Exports decorators and utilities for automatic route registration.
 * 
 * @module routing
 */

// Decorators
export {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  UseMiddleware,
  UseControllerMiddleware,
  Authenticate,
  ValidateBody,
  ValidateQuery,
  ValidateParams,
  CONTROLLER_KEY,
  ROUTES_KEY,
  MIDDLEWARE_KEY,
} from './decorators';

export type {
  HttpMethod,
  RouteMetadata,
} from './decorators';

// Registration
export {
  registerControllers,
  getControllerRoutes,
  getControllerBasePath,
} from './register';

export type {
  ControllerClass,
  RegisterOptions,
  RegisteredRoute,
} from './register';
