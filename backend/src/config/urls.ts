/**
 * URL Configuration
 *
 * Provides environment-aware URL defaults for the application.
 * Used to ensure proper URL redirects in both development and production environments.
 */

/**
 * Get the frontend URL with environment-aware defaults
 *
 * In development: Uses localhost:3001 as default
 * In production: Uses https://fringecore.space as default
 *
 * @returns Frontend URL from environment or appropriate default
 */
export function getFrontendUrl(): string {
  // If FRONTEND_URL is explicitly set, use it
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }

  // Environment-aware defaults
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? 'https://fringecore.space' : 'http://localhost:3001';
}

/**
 * Get the backend API URL with environment-aware defaults
 *
 * In development: Uses localhost:{PORT} as default
 * In production: Uses https://api.fringecore.space as default
 *
 * @returns Backend API URL from environment or appropriate default
 */
export function getBackendUrl(): string {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || '3000';
  return isProduction ? 'https://api.fringecore.space' : `http://localhost:${port}`;
}
