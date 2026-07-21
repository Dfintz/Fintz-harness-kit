/**
 * Re-export buildHateoasLinks from queryParser for backward compatibility
 * Some controllers still import from './hateoas' instead of '../middleware/queryParser'
 */
export { buildHateoasLinks } from '../middleware/queryParser';
