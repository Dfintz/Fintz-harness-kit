// Lightweight ESM shim for react-is to avoid UMD/CJS runtime issues
// Provides minimal exports used by hoist-non-react-statics and related libs
// This avoids the "Cannot set properties of undefined (setting 'AsyncMode')" error.
//
// NOTE: This module is aliased in vite.config.ts to replace react-is imports globally.
// It intercepts the module before @emotion/react can try to set properties on undefined exports.

export function isElement(_obj: unknown): boolean {
  // Conservative default: treat as not a React element
  return false;
}

export function isValidElementType(type: unknown): boolean {
  // Accept common valid element types without deep checks
  const t = typeof type;
  return t === 'string' || t === 'function' || t === 'symbol' || t === 'object';
}

export function isMemo(_obj: unknown): boolean {
  return false;
}

export function isForwardRef(_obj: unknown): boolean {
  return false;
}

export function isFragment(_obj: unknown): boolean {
  return false;
}

export function typeOf(_obj: unknown): unknown {
  return null;
}

export function isConcurrentMode(_obj: unknown): boolean {
  return false;
}

export function isContextConsumer(_obj: unknown): boolean {
  return false;
}

export function isContextProvider(_obj: unknown): boolean {
  return false;
}

export function isAsyncMode(_obj: unknown): boolean {
  return false;
}

export function isStrictMode(_obj: unknown): boolean {
  return false;
}

export function isSuspense(_obj: unknown): boolean {
  return false;
}

export function isProfiler(_obj: unknown): boolean {
  return false;
}

export function isPortal(_obj: unknown): boolean {
  return false;
}

export function isLazy(_obj: unknown): boolean {
  return false;
}

// Export legacy symbols/constants as safe objects that won't cause errors when properties are set
// Using Symbol to avoid conflicts with other code
const createSymbol = (name: string) => Symbol(name);

export const AsyncMode = createSymbol('AsyncMode');
export const ContextConsumer = createSymbol('ContextConsumer');
export const ContextProvider = createSymbol('ContextProvider');
export const Element = createSymbol('Element');
export const ForwardRef = createSymbol('ForwardRef');
export const Fragment = createSymbol('Fragment');
export const Lazy = createSymbol('Lazy');
export const Memo = createSymbol('Memo');
export const Portal = createSymbol('Portal');
export const Profiler = createSymbol('Profiler');
export const StrictMode = createSymbol('StrictMode');
export const Suspense = createSymbol('Suspense');

// Ensure we return an object for default export too
export const ReactIsShim = {
  isElement,
  isValidElementType,
  isMemo,
  isForwardRef,
  isFragment,
  typeOf,
  isConcurrentMode,
  isContextConsumer,
  isContextProvider,
  isAsyncMode,
  isStrictMode,
  isSuspense,
  isProfiler,
  isPortal,
  isLazy,
  AsyncMode,
  ContextConsumer,
  ContextProvider,
  Element,
  ForwardRef,
  Fragment,
  Lazy,
  Memo,
  Portal,
  Profiler,
  StrictMode,
  Suspense,
};
