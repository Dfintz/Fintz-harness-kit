/**
 * Integration tests for v2 social routes
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { json } from 'body-parser';
import express from 'express';
import request from 'supertest';

const mockCreatePost: jest.Mock = jest.fn();
const mockGetAllActivePosts: jest.Mock = jest.fn();
const mockGetActivePostsByGuild: jest.Mock = jest.fn();
const mockJoinPost: jest.Mock = jest.fn();
const mockLeavePost: jest.Mock = jest.fn();
const mockClosePost: jest.Mock = jest.fn();

const mockCreateSession: jest.Mock = jest.fn();
const mockFindOpenSessions: jest.Mock = jest.fn();
const mockJoinSession: jest.Mock = jest.fn();
const mockLeaveSession: jest.Mock = jest.fn();
const mockStartSession: jest.Mock = jest.fn();
const mockCompleteSession: jest.Mock = jest.fn();
const mockCancelSession: jest.Mock = jest.fn();

jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn(async (req: any, _res: any, next: any) => {
    req.user = {
      id: 'test-user-1',
      username: 'Test User',
      currentOrganizationId: 'org-1',
    };
    next();
  }),
}));

jest.mock('../../services/social/SocialGroupService', () => ({
  SocialGroupService: {
    getInstance: jest.fn(() => ({
      createPost: mockCreatePost,
      getAllActivePosts: mockGetAllActivePosts,
      getActivePostsByGuild: mockGetActivePostsByGuild,
      joinPost: mockJoinPost,
      leavePost: mockLeavePost,
      closePost: mockClosePost,
    })),
  },
}));

jest.mock('../../services/social/LFGSessionService', () => ({
  LFGSessionStatus: {
    OPEN: 'open',
    FULL: 'full',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  lfgSessionService: {
    createSession: mockCreateSession,
    findOpenSessions: mockFindOpenSessions,
    joinSession: mockJoinSession,
    leaveSession: mockLeaveSession,
    startSession: mockStartSession,
    completeSession: mockCompleteSession,
    cancelSession: mockCancelSession,
  },
}));

import { errorHandlerV2 } from '../../middleware/errorHandlerV2';
import { requestIdMiddleware } from '../../middleware/requestId';
import { standardResponseMiddleware } from '../../middleware/standardResponse';
import { router as socialRoutes } from '../../routes/v2/social';

describe('V2 Social Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(json());
    app.use(requestIdMiddleware);
    app.use(standardResponseMiddleware);
    app.use('/api/v2/social', socialRoutes);
    app.use(errorHandlerV2);

    jest.clearAllMocks();
  });

  describe('Group endpoints', () => {
    it('should create a group post', async () => {
      const mockPost = { id: 'post-1', activity: 'PVP', description: 'Test run' };
      mockCreatePost.mockReturnValue(mockPost);

      const response = await request(app).post('/api/v2/social/groups').send({
        activity: 'PVP',
        description: 'Test run',
        creatorName: 'Test User',
        maxPlayers: 5,
        guildId: 'guild-1',
        channelId: 'channel-1',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('post-1');
      expect(mockCreatePost).toHaveBeenCalled();
    });

    it('should reject invalid group creation payload', async () => {
      const response = await request(app).post('/api/v2/social/groups').send({
        description: 'Missing required fields',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should list group posts', async () => {
      mockGetAllActivePosts.mockImplementation(async () => [{ id: 'post-1' }, { id: 'post-2' }]);

      const response = await request(app).get('/api/v2/social/groups');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should join a group post', async () => {
      mockJoinPost.mockReturnValue({ id: 'post-1', members: ['test-user-1'] });

      const response = await request(app).post('/api/v2/social/groups/post-1/join');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockJoinPost).toHaveBeenCalledWith('post-1', 'test-user-1');
    });
  });

  describe('Session endpoints', () => {
    it('should create an LFG session', async () => {
      mockCreateSession.mockImplementation(async () => ({ id: 'session-1', title: 'PVE Mission' }));

      const response = await request(app).post('/api/v2/social/sessions').send({
        organizationId: 'org-1',
        activityType: 'PVE',
        title: 'PVE Mission',
        maxPlayers: 4,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('session-1');
    });

    it('should list sessions with filters', async () => {
      mockFindOpenSessions.mockImplementation(async () => [{ id: 'session-1' }]);

      const response = await request(app)
        .get('/api/v2/social/sessions')
        .query({ activityType: 'PVE', status: 'open' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockFindOpenSessions).toHaveBeenCalled();
    });

    it('should join a session', async () => {
      mockJoinSession.mockImplementation(async () => ({
        success: true,
        session: { id: 'session-1' },
      }));

      const response = await request(app).post('/api/v2/social/sessions/session-1/join');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockJoinSession).toHaveBeenCalledWith('session-1', 'test-user-1');
    });

    it('should return 400 when session join fails', async () => {
      mockJoinSession.mockImplementation(async () => ({
        success: false,
        error: 'Session is full',
      }));

      const response = await request(app).post('/api/v2/social/sessions/session-1/join');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session is full');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
