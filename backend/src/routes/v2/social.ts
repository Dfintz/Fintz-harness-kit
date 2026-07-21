import { NextFunction, Request, Response, Router } from 'express';

import { socialController } from '../../controllers/socialController';
import { AuthRequest, authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { socialSchemas } from '../../schemas/socialSchemas';

const router = Router();

const withAsyncRoute =
  (handler: (req: Request, res: Response) => void | Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res)).catch(next);
  };

const withAuthMiddleware =
  (middleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    middleware(req as AuthRequest, res, next).catch(next);
  };

router.use(withAuthMiddleware(authenticate));

// ==================== SOCIAL FEATURES ====================

/**
 * POST /api/v2/social/groups
 * Create LFG group post (SocialGroupService)
 */
router.post(
  '/groups',
  withAsyncRoute((req, res) => socialController.createGroup(req, res))
);

/**
 * GET /api/v2/social/groups
 * List active LFG group posts
 */
router.get(
  '/groups',
  validateSchema(socialSchemas.query, 'query'),
  withAsyncRoute((req, res) => socialController.listGroups(req, res))
);

/**
 * POST /api/v2/social/groups/:groupId/join
 * Join social group
 */
router.post(
  '/groups/:groupId/join',
  withAsyncRoute((req, res) => socialController.joinGroup(req, res))
);

/**
 * POST /api/v2/social/groups/:groupId/leave
 * Leave social group
 */
router.post(
  '/groups/:groupId/leave',
  withAsyncRoute((req, res) => socialController.leaveGroup(req, res))
);

/**
 * POST /api/v2/social/groups/:groupId/close
 * Close social group (creator only)
 */
router.post(
  '/groups/:groupId/close',
  withAsyncRoute((req, res) => socialController.closeGroup(req, res))
);

/**
 * POST /api/v2/social/groups/:groupId/convert-to-team
 * Convert LFG group into a persistent Team (carries over members)
 */
router.post(
  '/groups/:groupId/convert-to-team',
  withAsyncRoute((req, res) => socialController.convertGroupToTeam(req, res))
);

// ==================== LFG SESSIONS ====================

/**
 * POST /api/v2/social/sessions
 * Create an LFG session
 */
router.post(
  '/sessions',
  validateSchema(socialSchemas.createLfgSession, 'body'),
  withAsyncRoute((req, res) => socialController.createSession(req, res))
);

/**
 * GET /api/v2/social/sessions
 * Search/list LFG sessions
 */
router.get(
  '/sessions',
  validateSchema(socialSchemas.query, 'query'),
  withAsyncRoute((req, res) => socialController.listSessions(req, res))
);

/**
 * GET /api/v2/social/sessions/:sessionId
 * Get a single LFG session by ID
 */
router.get(
  '/sessions/:sessionId',
  withAsyncRoute((req, res) => socialController.getSession(req, res))
);

/**
 * POST /api/v2/social/sessions/:sessionId/join
 * Join LFG session
 */
router.post(
  '/sessions/:sessionId/join',
  withAsyncRoute((req, res) => socialController.joinSession(req, res))
);

/**
 * POST /api/v2/social/sessions/:sessionId/leave
 * Leave LFG session
 */
router.post(
  '/sessions/:sessionId/leave',
  withAsyncRoute((req, res) => socialController.leaveSession(req, res))
);

/**
 * POST /api/v2/social/sessions/:sessionId/start
 * Start LFG session (host only)
 */
router.post(
  '/sessions/:sessionId/start',
  withAsyncRoute((req, res) => socialController.startSession(req, res))
);

/**
 * POST /api/v2/social/sessions/:sessionId/complete
 * Complete LFG session (host only)
 */
router.post(
  '/sessions/:sessionId/complete',
  withAsyncRoute((req, res) => socialController.completeSession(req, res))
);

/**
 * POST /api/v2/social/sessions/:sessionId/cancel
 * Cancel LFG session (host only)
 */
router.post(
  '/sessions/:sessionId/cancel',
  withAsyncRoute((req, res) => socialController.cancelSession(req, res))
);

/**
 * GET /api/v2/social/friends
 * Get friends list
 * Query: status (all, pending, active)
 */
router.get(
  '/friends',
  withAsyncRoute((req, res) => socialController.getFriends(req, res))
);

/**
 * POST /api/v2/social/friends/:userId
 * Send friend request
 */
router.post(
  '/friends/:userId',
  withAsyncRoute((req, res) => socialController.addFriend(req, res))
);

/**
 * DELETE /api/v2/social/friends/:userId
 * Remove friend or cancel request
 */
router.delete(
  '/friends/:userId',
  withAsyncRoute((req, res) => socialController.removeFriend(req, res))
);

/**
 * POST /api/v2/social/friends/:userId/accept
 * Accept friend request
 */
router.post(
  '/friends/:userId/accept',
  withAsyncRoute((req, res) => socialController.acceptFriend(req, res))
);

/**
 * POST /api/v2/social/block/:userId
 * Block user
 */
router.post(
  '/block/:userId',
  withAsyncRoute((req, res) => socialController.blockUser(req, res))
);

/**
 * DELETE /api/v2/social/block/:userId
 * Unblock user
 */
router.delete(
  '/block/:userId',
  withAsyncRoute((req, res) => socialController.unblockUser(req, res))
);

/**
 * GET /api/v2/social/feed
 * Get social feed
 * Query: limit, offset, type
 */
router.get(
  '/feed',
  withAsyncRoute((req, res) => socialController.getFeed(req, res))
);

/**
 * POST /api/v2/social/posts
 * Create post
 * Request body: post data
 */
router.post(
  '/posts',
  withAsyncRoute((req, res) => socialController.createPost(req, res))
);

/**
 * POST /api/v2/social/posts/:postId/like
 * Like post
 */
router.post(
  '/posts/:postId/like',
  withAsyncRoute((req, res) => socialController.likePost(req, res))
);

/**
 * GET /api/v2/social/presence
 * Get user presence info
 * Query: userIds
 */
router.get(
  '/presence',
  withAsyncRoute((req, res) => socialController.getPresence(req, res))
);

export { router };
