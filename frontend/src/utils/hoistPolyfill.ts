/**
 * Polyfill for hoist-non-react-statics that works with React 18 + react-is 16
 * The original package is incompatible with the current dependency versions
 */

const REACT_STATICS = new Set([
  'childContextTypes',
  'contextType',
  'contextTypes',
  'defaultProps',
  'displayName',
  'getDefaultProps',
  'getDerivedStateFromError',
  'getDerivedStateFromProps',
  'propTypes',
  'type',
]);

const KNOWN_STATICS: Record<string, boolean> = {
  name: true,
  length: true,
  prototype: true,
  caller: true,
  callee: true,
  arguments: true,
  arity: true,
};

export function hoistNonReactStatics(
  targetComponent: Record<string, unknown>,
  sourceComponent: Record<string, unknown>,
  blacklist?: Record<string, boolean>
): Record<string, unknown> {
  if (typeof sourceComponent !== 'string') {
    const keys = Object.getOwnPropertyNames(sourceComponent);
    for (const key of keys) {
      if (!REACT_STATICS.has(key) && !KNOWN_STATICS[key] && !blacklist?.[key]) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(sourceComponent, key);
          if (descriptor?.enumerable) {
            Object.defineProperty(targetComponent, key, descriptor);
          }
        } catch (e) {
          // Silently ignore property copying errors
        }
      }
    }
  }

  return targetComponent;
}

// CommonJS compatibility
// eslint-disable-next-line import/no-default-export
export default hoistNonReactStatics;
