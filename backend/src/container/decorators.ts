/**
 * Dependency Injection Decorators and Utilities
 * 
 * Re-exports and extends tsyringe decorators with project-specific utilities.
 * 
 * @module container/decorators
 */

/* eslint-disable @typescript-eslint/no-unsafe-function-type */

export { injectable, inject, singleton, autoInjectable } from 'tsyringe';

import { injectable, singleton } from 'tsyringe';

// Constructor type for decorators
type Constructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Decorator for services that should be singletons
 * Combines @injectable() and @singleton()
 */
export function Service(): ClassDecorator {
  return function (target: Function) {
    singleton()(target as Constructor);
    injectable()(target as Constructor);
  };
}

/**
 * Decorator for transient services (new instance per resolution)
 */
export function TransientService(): ClassDecorator {
  return function (target: Function) {
    injectable()(target as Constructor);
  };
}
