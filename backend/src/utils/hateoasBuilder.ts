/**
 * Re-export buildHateoasLinks from queryParser for backward compatibility
 * Some controllers still import from './hateoasBuilder' instead of '../middleware/queryParser'
 */
export { buildHateoasLinks } from '../middleware/queryParser';
