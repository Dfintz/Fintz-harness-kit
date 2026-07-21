import { Request, Response, Router } from 'express';

import { adminRateLimit, requireAdmin } from '../../middleware/adminAuth';
import { authenticate } from '../../middleware/auth';
import { AuditCategory, auditService, AuditSeverity } from '../../services/audit/AuditService';

const router = Router();

// All audit routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);
router.use(adminRateLimit());

// ==================== AUDIT LOGGING ====================

/**
 * GET /api/v2/audit/logs
 * Get audit logs with filtering
 * Query: userId, action, category, severity, startDate, endDate, limit, offset
 */
router.get('/logs', (req: Request, res: Response) => {
  const { userId, action, category, severity, correlationId, startDate, endDate, limit, offset } =
    req.query;

  const entries = auditService.query({
    userId: userId as string,
    action: action as string,
    category: category as AuditCategory,
    severity: severity as AuditSeverity,
    correlationId: correlationId as string,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    limit: limit ? Number.parseInt(limit as string, 10) : 100,
    offset: offset ? Number.parseInt(offset as string, 10) : 0,
  });

  res.success(entries);
});

/**
 * GET /api/v2/audit/logs/:logId
 * Get specific audit log entry
 */
router.get('/logs/:logId', (req: Request, res: Response) => {
  const entry = auditService.getById(req.params.logId);
  if (!entry) {
    res.status(404).json({ success: false, message: 'Audit log entry not found' });
    return;
  }
  res.success(entry);
});

/**
 * GET /api/v2/audit/user/:userId
 * Get audit logs for specific user
 */
router.get('/user/:userId', (req: Request, res: Response) => {
  const { limit, offset } = req.query;
  const entries = auditService.query({
    userId: req.params.userId,
    limit: limit ? Number.parseInt(limit as string, 10) : 100,
    offset: offset ? Number.parseInt(offset as string, 10) : 0,
  });
  res.success(entries);
});

/**
 * GET /api/v2/audit/organization/:orgId
 * Get audit logs for organization
 */
router.get('/organization/:orgId', (req: Request, res: Response) => {
  const { limit, offset, category } = req.query;
  const entries = auditService.query({
    organizationId: req.params.orgId,
    category: category as AuditCategory,
    limit: limit ? Number.parseInt(limit as string, 10) : 100,
    offset: offset ? Number.parseInt(offset as string, 10) : 0,
  });
  res.success(entries);
});

/**
 * GET /api/v2/audit/statistics
 * Get audit log statistics, optionally scoped to an organization
 */
router.get('/statistics', (req: Request, res: Response) => {
  const { orgId } = req.query;
  const stats = auditService.getStatistics(orgId as string);
  res.success(stats);
});

/**
 * GET /api/v2/audit/export
 * Export audit logs as JSON
 * Query: format, startDate, endDate, category
 */
router.get('/export', (req: Request, res: Response) => {
  const { startDate, endDate, category } = req.query;
  const entries = auditService.query({
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined,
    category: category as AuditCategory,
    limit: 10000,
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.json"`
  );
  res.json({ success: true, data: entries, exportedAt: new Date().toISOString() });
});

/**
 * POST /api/v2/audit/retention
 * Configure audit log retention (placeholder for future DB-backed persistence)
 * Request body: { retentionDays: number }
 */
router.post('/retention', (req: Request, res: Response) => {
  const { retentionDays } = req.body;
  if (!retentionDays || typeof retentionDays !== 'number' || retentionDays < 1) {
    res.status(400).json({ success: false, message: 'retentionDays must be a positive number' });
    return;
  }
  // Retention configuration will be enforced when DB persistence is added
  res.success({
    message: 'Retention policy updated',
    retentionDays,
    note: 'File-based retention is controlled by AUDIT_LOG_MAX_FILES env variable',
  });
});

export { router };
