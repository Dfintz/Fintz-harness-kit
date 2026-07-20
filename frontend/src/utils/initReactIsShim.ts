/**
 * Initialize the react-is shim BEFORE any other modules load.
 * This module must be imported in index.tsx as the very first import.
 *
 * The problem: @emotion/react depends on hoist-non-react-statics which depends on react-is.
 * When react-is tries to attach properties to exports (in UMD mode), exports may be undefined,
 * causing "Cannot set properties of undefined" errors.
 *
 * Solution: Replace the global module cache entry for 'react-is' with our shim before
 * any other module can try to import and use it.
 */

// In modern bundlers (Vite ESM), the shim is already available through the alias.
// This module just serves as a documentation point and potential future expansion.

export {};
