import Joi from 'joi';

/**
 * Authentication Validation Schemas
 *
 * Validation for authentication and session management endpoints
 */

export const authSchemas = {
  // Login - username and password
  login: Joi.object({
    username: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'Username is required',
      'any.required': 'Username is required',
    }),
    password: Joi.string().min(1).max(256).required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
  }),

  // Development/demo login - optional identifiers
  demoLogin: Joi.object({
    username: Joi.string().trim().min(1).max(100),
    email: Joi.string()
      .trim()
      .email({ tlds: { allow: false } }),
    role: Joi.string().trim().valid('admin', 'user', 'moderator').messages({
      'any.only': 'Role must be admin, user, or moderator',
    }),
  }),

  // Production-safe sandbox login (no caller-controlled identity/role)
  sandboxLogin: Joi.object({}).max(0).messages({
    'object.max': 'Sandbox login does not accept request body fields',
  }),

  // Refresh token
  refresh: Joi.object({
    refreshToken: Joi.string().trim().min(1).required().messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required',
    }),
  }),

  // Logout - refresh token
  // Optional when using httpOnly cookies (cookie-based auth)
  logout: Joi.object({
    refreshToken: Joi.string().trim().min(1).optional().messages({
      'string.empty': 'Refresh token is required',
    }),
  }),
};
