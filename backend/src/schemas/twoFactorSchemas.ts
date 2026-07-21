import Joi from 'joi';

/**
 * Two-Factor Authentication Validation Schemas
 *
 * Validation for 2FA setup, verification, and management endpoints
 */

export const twoFactorSchemas = {
  // Verify 2FA code (6 digits)
  verify: Joi.object({
    token: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must only contain numbers',
      'any.required': 'Verification code is required',
    }),
    backupCodes: Joi.array().items(Joi.string().trim().min(1)).required().messages({
      'any.required': 'Backup codes are required',
      'array.base': 'Backup codes must be an array',
    }),
  }),

  // Disable 2FA with password confirmation
  disable: Joi.object({
    password: Joi.string().min(1).required().messages({
      'any.required': 'Password is required to disable 2FA',
    }),
    token: Joi.string().trim().length(6).pattern(/^\d+$/).optional().messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must only contain numbers',
    }),
  }),

  // Verify 2FA login (includes user ID and token)
  verifyLogin: Joi.object({
    userId: Joi.string().trim().min(1).required().messages({
      'any.required': 'User ID is required',
    }),
    token: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
      'string.length': 'Verification code must be exactly 6 digits',
      'string.pattern.base': 'Verification code must only contain numbers',
      'any.required': 'Verification code is required',
    }),
    rememberDevice: Joi.boolean().optional().default(false),
  }),

  // Use backup code
  useBackupCode: Joi.object({
    backupCode: Joi.string().trim().min(6).max(16).required().messages({
      'any.required': 'Backup code is required',
    }),
  }),
};
