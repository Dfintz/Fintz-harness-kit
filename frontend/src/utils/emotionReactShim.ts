/**
 * Shim for @emotion/react that ensures react-is is initialized first.
 * This module is imported FIRST in index.tsx before React modules load.
 */

import './reactIsShim';

// Once react-is shim is loaded, we can safely import @emotion/react
export * from '@emotion/react';
