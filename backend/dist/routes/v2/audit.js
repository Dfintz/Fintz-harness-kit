"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const adminAuth_1 = require("../../middleware/adminAuth");
const auth_1 = require("../../middleware/auth");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const AuditService_1 = require("../../services/audit/AuditService");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.use(adminAuth_1.requireAdmin);
router.use(rateLimiting_1.adminRateLimiter);
router.get('/logs', (req, res) => {
    const { userId, action, category, severity, correlationId, startDate, endDate, limit, offset } = req.query;
    const entries = AuditService_1.auditService.query({
        userId: userId,
        action: action,
        category: category,
        severity: severity,
        correlationId: correlationId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : 100,
        offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    res.success(entries);
});
router.get('/logs/:logId', (req, res) => {
    const entry = AuditService_1.auditService.getById(req.params.logId);
    if (!entry) {
        res.status(404).json({ success: false, message: 'Audit log entry not found' });
        return;
    }
    res.success(entry);
});
router.get('/user/:userId', (req, res) => {
    const { limit, offset } = req.query;
    const entries = AuditService_1.auditService.query({
        userId: req.params.userId,
        limit: limit ? Number.parseInt(limit, 10) : 100,
        offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    res.success(entries);
});
router.get('/organization/:orgId', (req, res) => {
    const { limit, offset, category } = req.query;
    const entries = AuditService_1.auditService.query({
        organizationId: req.params.orgId,
        category: category,
        limit: limit ? Number.parseInt(limit, 10) : 100,
        offset: offset ? Number.parseInt(offset, 10) : 0,
    });
    res.success(entries);
});
router.get('/statistics', (req, res) => {
    const { orgId } = req.query;
    const stats = AuditService_1.auditService.getStatistics(orgId);
    res.success(stats);
});
router.get('/export', (req, res) => {
    const { startDate, endDate, category } = req.query;
    const entries = AuditService_1.auditService.query({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        category: category,
        limit: 10000,
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.json"`);
    res.json({ success: true, data: entries, exportedAt: new Date().toISOString() });
});
router.post('/retention', (req, res) => {
    const { retentionDays } = req.body;
    if (!retentionDays || typeof retentionDays !== 'number' || retentionDays < 1) {
        res.status(400).json({ success: false, message: 'retentionDays must be a positive number' });
        return;
    }
    res.success({
        message: 'Retention policy updated',
        retentionDays,
        note: 'File-based retention is controlled by AUDIT_LOG_MAX_FILES env variable',
    });
});
//# sourceMappingURL=audit.js.map