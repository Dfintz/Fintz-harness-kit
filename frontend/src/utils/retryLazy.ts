/**
 * retryLazy — Retry wrapper for React.lazy dynamic imports.
 *
 * After a deployment, chunk filenames change (content-hash). Users with a
 * cached HTML page may request stale chunk URLs that no longer exist (404).
 * This wrapper retries the import once, then forces a full page reload to
 * pick up the new HTML. A sessionStorage flag prevents infinite reload loops.
 */
import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'chunk_reload';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyFactory = () => Promise<{ default: ComponentType<any> }>;

/**
 * Wrap a dynamic import factory so chunk load failures trigger a page reload.
 *
 * Usage (drop-in replacement for `React.lazy`):
 * ```ts
 * const Page = retryLazy(() =>
 *   import('@/pages/Dashboard').then(m => ({ default: m.Dashboard }))
 * );
 * ```
 */
export function retryLazy(factory: LazyFactory) {
  return lazy(() => importWithReload(factory));
}

async function importWithReload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: LazyFactory
): Promise<{ default: ComponentType<any> }> {
  try {
    return await factory();
  } catch (error: unknown) {
    if (!isChunkLoadError(error)) {
      throw error;
    }

    // Chunk load failed (stale deployment). Reload the page once to
    // pick up the new HTML with correct chunk URLs.
    if (globalThis.window !== undefined && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      globalThis.location.reload();
      // Return a never-resolving promise so React doesn't render an error
      // page during the brief window before the browser navigates away.
      return new Promise(() => {});
    }

    // Already reloaded once this session — clear flag and let it fail
    // so the error boundary can show the "reload" message.
    sessionStorage.removeItem(RELOAD_FLAG);
    throw error;
  }
}

/**
 * Detect whether an error is a chunk/module load failure.
 * Exported so RouteErrorBoundary can reuse the same detection.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('dynamically imported module')
  );
}
