import Joi from 'joi';

/**
 * Secrets management validation schemas
 *
 * Used by SecretsController endpoints for request validation.
 * Covers secret rotation, status queries, and reload operations.
 */

export const secretsSchemas = {
  // GET /api/secrets/rotation/check (query params)
  checkRotation: Joi.object({
    maxAge: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .default(90)
      .description('Maximum age in days before rotation is recommended'),
  }),

  // POST /api/secrets/rotate/jwt
  rotateJwt: Joi.object({
    confirm: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must confirm with { "confirm": true } to proceed',
    }),
  }),

  // POST /api/secrets/rotate/encryption
  rotateEncryption: Joi.object({
    confirm: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must confirm with { "confirm": true } to proceed',
    }),
  }),

  // POST /api/secrets/rotate/db-password
  rotateDbPassword: Joi.object({
    newPassword: Joi.string()
      .min(12)
      .max(256)
      .required()
      .description('New database password (minimum 12 characters)'),
    confirm: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must confirm with { "confirm": true } to proceed',
    }),
  }),
};
