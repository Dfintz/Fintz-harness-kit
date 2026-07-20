/**
 * Buffer polyfill for browser environment.
 *
 * bip39@3.x and its sub-dependencies (create-hash, randombytes, pbkdf2) reference
 * `Buffer` as a global — which exists in Node.js but not in browsers.
 * The `buffer` npm package provides a browser-compatible implementation.
 *
 * This module must be imported early (before bip39 is used) so that
 * `globalThis.Buffer` is available when bip39 internal code runs.
 */

import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
