import Joi from 'joi';

/**
 * Joi validation schemas for invitation endpoints.
 */
export const invitationSchemas = {
  /** POST /organizations/:orgId/invitations — send invitation (inviteMember) */
  invite: Joi.object({
    email: Joi.string().email().required().description('Email address of user to invite'),
    role: Joi.string()
      .valid('member', 'officer', 'admin')
      .optional()
      .default('member')
      .description('Role for the invited member'),
    title: Joi.string().max(100).optional().description('Job title for the member'),
    expiresAt: Joi.date()
      .iso()
      .optional()
      .description('Invitation expiration date (defaults to 7 days from now)'),
    message: Joi.string()
      .max(500)
      .optional()
      .description('Optional message to include in invitation'),
    metadata: Joi.object().optional(),
  }),

  /** POST /organizations/:orgId/invitations/:invitationId/accept — accept invitation */
  accept: Joi.object({
    invitationId: Joi.string().uuid().required().description('Invitation ID'),
    token: Joi.string().hex().length(64).required().description('Invitation token from email link'),
  }),

  /** POST /organizations/:orgId/invitations/:invitationId/decline — decline invitation */
  decline: Joi.object({
    invitationId: Joi.string().uuid().required().description('Invitation ID'),
    token: Joi.string().hex().length(64).required().description('Invitation token from email link'),
  }),

  /** GET /organizations/:orgId/invitations (query params) */
  listQuery: Joi.object({
    status: Joi.string()
      .valid('pending', 'approved', 'accepted', 'rejected', 'declined', 'expired')
      .optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  }),

  // Backward compatibility alias
  get send() {
    return this.invite;
  },
};
