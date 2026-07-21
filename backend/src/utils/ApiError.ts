/**
 * Re-export ApiError from apiErrors for backward compatibility
 * Some controllers still import from './ApiError' instead of './apiErrors'
 */
export { ApiError } from './apiErrors';
