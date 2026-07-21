import { Express, NextFunction, Request, Response, Router } from 'express';

import { RecruitmentController } from '../controllers/recruitmentController';
import { botOrUserAuth } from '../middleware/botOrUserAuth';
import { validateSchema } from '../middleware/schemaValidation';
import { paramSchemas, recruitmentSchemas } from '../schemas';

const router = Router();
// Lazy initialization to avoid EntityMetadataNotFoundError
let recruitmentController: RecruitmentController;
const getController = (): RecruitmentController => {
  if (!recruitmentController) {
    recruitmentController = new RecruitmentController();
  }
  return recruitmentController;
};

/**
 * Optional bot-or-user auth. Used on public read endpoints (org directory
 * recruitment listings) where:
 *   - Discord bot calls (X-Bot-Internal-Token) MUST still flow through
 *     botOrUserAuth so tenant context is resolved from the guild.
 *   - JWT-authenticated users get req.user populated for per-user fields
 *     (e.g. hasApplied).
 *   - Anonymous visitors fall through with no req.user so they can read
 *     public recruitment posts on org profile pages.
 *
 * A 401 from botOrUserAuth on an anonymous browser request is swallowed
 * and converted to a pass-through.
 */
const optionalBotOrUserAuth = (req: Request, res: Response, next: NextFunction): void => {
  const hasBotToken = !!req.headers['x-bot-internal-token'];
  const hasJwt = !!req.headers['authorization'] || !!req.cookies?.access_token;
  const hasApiKey = !!req.headers['x-api-key'];

  if (!hasBotToken && !hasJwt && !hasApiKey) {
    next();
    return;
  }

  // Bot requests must always go through real auth (tenant context is required).
  if (hasBotToken) {
    void botOrUserAuth(req as Parameters<typeof botOrUserAuth>[0], res, next);
    return;
  }

  // User auth attempt: swallow 401 so an expired/invalid cookie on a public
  // page view falls through to anonymous access instead of erroring.
  const originalStatus = res.status.bind(res);
  const originalJson = res.json.bind(res);
  let authFailed = false;
  let settled = false;

  res.status = (code: number) => {
    if (!settled && code === 401) {
      authFailed = true;
      return res;
    }
    return originalStatus(code);
  };
  res.json = (body: unknown) => {
    if (authFailed && !settled) {
      settled = true;
      res.status = originalStatus;
      res.json = originalJson;
      next();
      return res;
    }
    return originalJson(body);
  };

  void botOrUserAuth(req as Parameters<typeof botOrUserAuth>[0], res, (err?: unknown) => {
    settled = true;
    res.status = originalStatus;
    res.json = originalJson;
    next(err);
  });
};

// ==================== PUBLIC READ ROUTES ====================
// Listing and single-recruitment GETs are public so anonymous visitors on
// /directory/:slug can see active recruitment posts. Authenticated users
// and the Discord bot still get req.user / tenantContext via optional auth.
// More-specific authenticated GETs (e.g. /my-applications) must be declared
// BEFORE the public /:id route to avoid the parameterized route swallowing
// them.

router.get(
  '/',
  optionalBotOrUserAuth,
  validateSchema(recruitmentSchemas.query, 'query'),
  (req, res) => getController().listRecruitments(req, res)
);

// Get user's applications — specific path declared before /:id, with its
// own botOrUserAuth (this route requires auth/bot context).
router.get('/my-applications', botOrUserAuth, (req, res) =>
  getController().getMyApplications(req, res)
);

router.get('/:id', optionalBotOrUserAuth, validateSchema(paramSchemas.id, 'params'), (req, res) =>
  getController().getRecruitment(req, res)
);

// ==================== AUTHENTICATED ROUTES ====================
// All routes below accept either an authenticated user (JWT cookie/Bearer) OR
// the Discord bot (X-Bot-Internal-Token + X-Discord-Guild-Id headers).
// botOrUserAuth resolves req.user + req.tenantContext for both flows.
router.use(botOrUserAuth);

// ==================== DISCORD INTEGRATION ====================
// These routes support both authenticated users and Discord header-based identification.

// Discord apply endpoint (uses Discord headers for identification)
router.post('/:id/discord-apply', (req, res) => getController().discordApply(req, res));

// Create invite binding
router.post('/:id/invite-binding', (req, res) => getController().createInviteBinding(req, res));

// ==================== CRUD OPERATIONS ====================

// Create recruitment
router.post('/', validateSchema(recruitmentSchemas.create, 'body'), (req, res) =>
  getController().createRecruitment(req, res)
);

// Update recruitment
router.put(
  '/:id',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.update, 'body'),
  (req, res) => getController().updateRecruitment(req, res)
);

// Delete recruitment
router.delete('/:id', validateSchema(paramSchemas.id, 'params'), (req, res) =>
  getController().deleteRecruitment(req, res)
);

// ==================== STATUS MANAGEMENT ====================

// Update recruitment status
router.put(
  '/:id/status',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.updateStatus, 'body'),
  (req, res) => getController().updateStatus(req, res)
);

// ==================== APPLICATION MANAGEMENT ====================

// Submit application
router.post(
  '/:id/apply',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.apply, 'body'),
  (req, res) => getController().submitApplication(req, res)
);

// List applications for a recruitment
router.get(
  '/:id/applications',
  validateSchema(paramSchemas.id, 'params'),
  validateSchema(recruitmentSchemas.applicationQuery, 'query'),
  (req, res) => getController().listApplications(req, res)
);

// Review application (accept/reject)
router.put(
  '/:id/applications/:applicationId',
  validateSchema(recruitmentSchemas.applicationParams, 'params'),
  validateSchema(recruitmentSchemas.reviewApplication, 'body'),
  (req, res) => getController().reviewApplication(req, res)
);

export const setRecruitmentRoutes = (app: Express): void => {
  app.use('/api/v2/recruitment', router);
  // Legacy alias for backward compatibility
  app.use('/api/recruitments', router);
};
