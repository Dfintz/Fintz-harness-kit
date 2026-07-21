import express, { Application } from 'express';
import request from 'supertest';
import { authenticate } from '../../middleware/auth';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';

// Mock middleware first
jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', activeOrgId: null };
    next();
  }),
  authenticateToken: jest.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', activeOrgId: null };
    next();
  }),
  generateToken: jest.fn(() => 'mock-jwt-token'),
}));
jest.mock('../../middleware/tenantContext');
jest.mock('../../middleware/schemaValidation', () => ({
  validateSchema: () => (req: any, res: any, next: any) => next(),
}));

// Mock controller with actual implementation
const mockControllerMethods = {
  listBounties: jest.fn((req, res) => res.status(200).json({ bounties: [] })),
  getBounty: jest.fn((req, res) => res.status(200).json({ id: req.params.id })),
  createBounty: jest.fn((req, res) => res.status(201).json({ id: 'new-bounty' })),
  updateBounty: jest.fn((req, res) => res.status(200).json({ id: req.params.id })),
  deleteBounty: jest.fn((req, res) => res.status(204).send()),
  claimBounty: jest.fn((req, res) => res.status(201).json({ claimId: 'new-claim' })),
  getPendingClaims: jest.fn((req, res) => res.status(200).json({ claims: [] })),
  getMyClaimsWithStats: jest.fn((req, res) => res.status(200).json({ claims: [], stats: {} })),
  getBountyClaims: jest.fn((req, res) => res.status(200).json({ claims: [] })),
  updateClaim: jest.fn((req, res) => res.status(200).json({ claimId: req.params.claimId })),
  deleteClaim: jest.fn((req, res) => res.status(204).send()),
  submitClaim: jest.fn((req, res) => res.status(200).json({ claimId: req.params.claimId })),
  submitEvidence: jest.fn((req, res) => res.status(201).json({ evidenceId: 'new-evidence' })),
  getClaimEvidence: jest.fn((req, res) => res.status(200).json({ evidence: [] })),
  deleteEvidence: jest.fn((req, res) => res.status(204).send()),
};

jest.mock('../../controllers/bountyController', () => ({
  BountyController: jest.fn().mockImplementation(() => mockControllerMethods),
}));

// Import routes after mocking
import bountyRoutes from '../bountyRoutes';

describe('Bounty Routes Access Control', () => {
  let app: Application;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/bounties', bountyRoutes);

    // Setup default middleware behavior
    (authenticate as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'test-user-id', activeOrgId: null };
      next();
    });

    (tenantContextMiddleware as jest.Mock).mockImplementation((req, res, next) => next());
    (requireTenantContext as jest.Mock).mockImplementation((req, res, next) => {
      if (!req.user?.activeOrgId) {
        return res.status(403).json({ error: 'Organization membership required' });
      }
      next();
    });
  });

  describe('Public Routes (No Authentication)', () => {
    it('should allow public bounty listing without auth', async () => {
      const response = await request(app).get('/api/bounties/public');

      expect(response.status).toBe(200);
      expect(mockControllerMethods.listBounties).toHaveBeenCalled();
      expect(authenticate).not.toHaveBeenCalled();
    });

    it('should allow viewing specific public bounty without auth', async () => {
      const response = await request(app).get('/api/bounties/public/bounty-123');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('bounty-123');
      expect(mockControllerMethods.getBounty).toHaveBeenCalled();
      expect(authenticate).not.toHaveBeenCalled();
    });
  });

  describe('Authenticated Routes (No Org Required)', () => {
    it('should allow authenticated users to list all bounties', async () => {
      const response = await request(app)
        .get('/api/bounties')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(requireTenantContext).not.toHaveBeenCalled();
    });

    it('should allow authenticated users to view specific bounty', async () => {
      const response = await request(app)
        .get('/api/bounties/bounty-123')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(authenticate).toHaveBeenCalled();
      expect(requireTenantContext).not.toHaveBeenCalled();
    });

    it('should allow authenticated users to claim bounties without org', async () => {
      const response = await request(app)
        .post('/api/bounties/bounty-123/claim')
        .set('Authorization', 'Bearer mock-token')
        .send({ notes: 'Accepting bounty' });

      expect(response.status).toBe(201);
      expect(authenticate).toHaveBeenCalled();
      expect(requireTenantContext).not.toHaveBeenCalled();
    });

    it('should require org membership for pending claims', async () => {
      const response = await request(app)
        .get('/api/bounties/claims/pending')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(authenticate).toHaveBeenCalled();
      expect(requireTenantContext).toHaveBeenCalled();
    });

    it('should require org membership for my-claims', async () => {
      const response = await request(app)
        .get('/api/bounties/claims/my-claims')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
      expect(authenticate).toHaveBeenCalled();
      expect(requireTenantContext).toHaveBeenCalled();
    });

    it('should allow authenticated users to submit evidence', async () => {
      const response = await request(app)
        .post('/api/bounties/bounty-123/claims/claim-456/evidence')
        .set('Authorization', 'Bearer mock-token')
        .send({ type: 'screenshot', url: 'https://example.com/proof.png' });

      expect(response.status).toBe(201);
      expect(authenticate).toHaveBeenCalled();
      expect(requireTenantContext).not.toHaveBeenCalled();
    });
  });

  describe('Organization-Scoped Routes', () => {
    it('should require org membership to create bounty', async () => {
      const response = await request(app)
        .post('/api/bounties')
        .set('Authorization', 'Bearer mock-token')
        .send({ title: 'New Bounty', reward: 1000 });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Organization membership required');
    });

    it('should allow org members to create bounty', async () => {
      // Mock user with active org
      (authenticate as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', activeOrgId: 'org-123' };
        next();
      });

      const response = await request(app)
        .post('/api/bounties')
        .set('Authorization', 'Bearer mock-token')
        .send({ title: 'New Bounty', reward: 1000 });

      expect(response.status).toBe(201);
      expect(mockControllerMethods.createBounty).toHaveBeenCalled();
    });

    it('should require org membership to update bounty', async () => {
      const response = await request(app)
        .patch('/api/bounties/bounty-123')
        .set('Authorization', 'Bearer mock-token')
        .send({ reward: 2000 });

      expect(response.status).toBe(403);
    });

    it('should require org membership to delete bounty', async () => {
      const response = await request(app)
        .delete('/api/bounties/bounty-123')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(403);
    });

    it('should require org membership to approve/reject claims', async () => {
      const response = await request(app)
        .patch('/api/bounties/bounty-123/claims/claim-456')
        .set('Authorization', 'Bearer mock-token')
        .send({ status: 'approved' });

      expect(response.status).toBe(403);
    });
  });

  describe('Route Order and Specificity', () => {
    it('should match /claims/pending before generic /:id route', async () => {
      // Provide org context so request passes tenant middleware
      (authenticate as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', activeOrgId: 'org-123' };
        next();
      });

      const response = await request(app)
        .get('/api/bounties/claims/pending')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(mockControllerMethods.getPendingClaims).toHaveBeenCalled();
      expect(mockControllerMethods.getBounty).not.toHaveBeenCalled();
    });

    it('should match /claims/my-claims before generic /:id route', async () => {
      // Provide org context so request passes tenant middleware
      (authenticate as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { id: 'test-user-id', activeOrgId: 'org-123' };
        next();
      });

      const response = await request(app)
        .get('/api/bounties/claims/my-claims')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(mockControllerMethods.getMyClaimsWithStats).toHaveBeenCalled();
      expect(mockControllerMethods.getBounty).not.toHaveBeenCalled();
    });

    it('should match /public/:id for public bounty viewing', async () => {
      const response = await request(app).get('/api/bounties/public/bounty-123');

      expect(response.status).toBe(200);
      expect(mockControllerMethods.getBounty).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
