// Mock data-source and logger before imports
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEventType: {
    SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS',
  },
}));

import { AppDataSource } from '../../data-source';
import { DataBreachNotification } from '../../models/DataBreachNotification';
import { User } from '../../models/User';
import {
  IncidentResponseService,
  BreachReport,
} from '../../services/compliance/IncidentResponseService';
import { NotificationService } from '../../services/communication/notifications/NotificationService';
import { logAuditEvent } from '../../utils/auditLogger';

describe('IncidentResponseService', () => {
  let service: IncidentResponseService;
  let mockBreachRepository: any;
  let mockUserRepository: any;
  let mockNotificationService: jest.Mocked<Partial<NotificationService>>;

  const sampleBreachReport: BreachReport = {
    title: 'Credential Leak',
    description: 'User credentials were exposed via misconfigured storage',
    severity: 'high',
    affectedUsers: ['user-1', 'user-2'],
    affectedDataTypes: ['EMAIL', 'USERNAME'],
  };

  const createMockIncident = (overrides: Partial<DataBreachNotification> = {}): any => ({
    id: 'incident-123',
    title: sampleBreachReport.title,
    description: sampleBreachReport.description,
    severity: 'high' as const,
    affectedUsers: ['user-1', 'user-2'],
    affectedDataTypes: ['EMAIL', 'USERNAME'],
    discoveredAt: new Date('2026-01-15T10:00:00Z'),
    status: 'INVESTIGATING',
    notifiedUsers: [],
    notificationErrors: [],
    remediationSteps: [],
    recommendations: [],
    notifiedAt: null,
    containedAt: null,
    resolvedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.APP_URL = 'https://fleet.example.com';
    process.env.SECURITY_EMAIL = 'security@fleet.example.com';
    process.env.LEGAL_EMAIL = 'legal@fleet.example.com';
    delete process.env.SECURITY_WEBHOOK_URL;

    mockBreachRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockNotificationService = {
      sendEmailNotification: jest.fn().mockResolvedValue({
        success: true,
        channel: 'email',
        recipientCount: 1,
      }),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === DataBreachNotification) return mockBreachRepository;
      if (entity === User) return mockUserRepository;
      return {};
    });

    service = new IncidentResponseService(
      mockNotificationService as unknown as NotificationService,
    );
  });

  // ─── reportBreach ───────────────────────────────────────────────────────

  describe('reportBreach', () => {
    it('should create and save a new incident with INVESTIGATING status', async () => {
      const saved = createMockIncident();
      mockBreachRepository.save.mockResolvedValue(saved);

      const result = await service.reportBreach(sampleBreachReport);

      expect(mockBreachRepository.save).toHaveBeenCalledTimes(1);
      const arg = mockBreachRepository.save.mock.calls[0][0];
      expect(arg.title).toBe(sampleBreachReport.title);
      expect(arg.status).toBe('INVESTIGATING');
      expect(arg.severity).toBe('high');
      expect(result.id).toBe('incident-123');
    });

    it('should log an audit event after creating the incident', async () => {
      mockBreachRepository.save.mockResolvedValue(createMockIncident());

      await service.reportBreach(sampleBreachReport);

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'SENSITIVE_DATA_ACCESS',
          message: expect.stringContaining('Data breach reported'),
        }),
      );
    });

    it('should notify admins for critical severity', async () => {
      const criticalReport: BreachReport = {
        ...sampleBreachReport,
        severity: 'critical',
      };
      const saved = createMockIncident({ severity: 'critical' });
      mockBreachRepository.save.mockResolvedValue(saved);

      const adminUser = { id: 'admin-1', email: 'admin@fleet.example.com', role: 'admin' };
      mockUserRepository.find.mockResolvedValue([adminUser]);

      await service.reportBreach(criticalReport);

      // Admin notification sends email through notificationService
      expect(mockNotificationService.sendEmailNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('[CRITICAL]'),
          recipientEmails: ['admin@fleet.example.com'],
        }),
      );
    });

    it('should NOT notify admins for non-critical severity', async () => {
      mockBreachRepository.save.mockResolvedValue(createMockIncident());

      await service.reportBreach(sampleBreachReport);

      // sendEmailNotification should NOT be called for high severity
      expect(mockNotificationService.sendEmailNotification).not.toHaveBeenCalled();
    });

    it('should set discoveredAt, empty arrays, and status defaults', async () => {
      mockBreachRepository.save.mockImplementation((inc: any) => ({
        id: 'inc-new',
        ...inc,
      }));

      await service.reportBreach(sampleBreachReport);

      const saved = mockBreachRepository.save.mock.calls[0][0];
      expect(saved.discoveredAt).toBeInstanceOf(Date);
      expect(saved.notifiedUsers).toEqual([]);
      expect(saved.notificationErrors).toEqual([]);
      expect(saved.remediationSteps).toEqual([]);
      expect(saved.recommendations).toEqual([]);
    });
  });

  // ─── notifyAffectedUsers ───────────────────────────────────────────────

  describe('notifyAffectedUsers', () => {
    it('should send email to each affected user with a valid email', async () => {
      const incident = createMockIncident();
      mockUserRepository.findOne
        .mockResolvedValueOnce({ id: 'user-1', email: 'u1@test.com', username: 'user1' })
        .mockResolvedValueOnce({ id: 'user-2', email: 'u2@test.com', username: 'user2' });
      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(mockNotificationService.sendEmailNotification).toHaveBeenCalledTimes(2);
      expect(incident.notifiedUsers).toHaveLength(2);
      expect(incident.status).toBe('NOTIFIED');
    });

    it('should skip users without an email address', async () => {
      const incident = createMockIncident({ affectedUsers: ['no-email-user'] });
      mockUserRepository.findOne.mockResolvedValue({ id: 'no-email-user', email: null });
      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(mockNotificationService.sendEmailNotification).not.toHaveBeenCalled();
      expect(incident.notifiedUsers).toHaveLength(0);
    });

    it('should record notification errors when sendEmail fails', async () => {
      const incident = createMockIncident({ affectedUsers: ['user-fail'] });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-fail',
        email: 'fail@test.com',
        username: 'failuser',
      });
      mockNotificationService.sendEmailNotification!.mockRejectedValue(
        new Error('SMTP down'),
      );
      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(incident.notificationErrors).toHaveLength(1);
      expect(incident.notificationErrors[0].error).toContain('SMTP down');
    });

    it('should update status to NOTIFIED and set notifiedAt', async () => {
      const incident = createMockIncident({ affectedUsers: ['user-1'] });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'u1@test.com',
        username: 'u1',
      });
      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(incident.status).toBe('NOTIFIED');
      expect(incident.notifiedAt).toBeInstanceOf(Date);
      expect(mockBreachRepository.save).toHaveBeenCalled();
    });

    it('should work without a notificationService (undefined)', async () => {
      const serviceWithoutNotif = new IncidentResponseService();
      const incident = createMockIncident({ affectedUsers: ['user-1'] });
      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'u1@test.com',
        username: 'u1',
      });
      mockBreachRepository.save.mockResolvedValue(incident);

      await serviceWithoutNotif.notifyAffectedUsers(incident);

      // Should still record success even though no email was physically sent
      expect(incident.notifiedUsers).toHaveLength(1);
    });
  });

  // ─── generateBreachReport ──────────────────────────────────────────────

  describe('generateBreachReport', () => {
    it('should generate a markdown report containing incident details', async () => {
      const incident = createMockIncident({
        remediationSteps: ['Rotated credentials', 'Patched vulnerability'],
        recommendations: ['Enable 2FA'],
      });

      const report = await service.generateBreachReport(incident);

      expect(report).toContain('INCIDENT REPORT');
      expect(report).toContain(incident.id);
      expect(report).toContain(incident.title);
      expect(report).toContain('Rotated credentials');
      expect(report).toContain('Enable 2FA');
    });

    it('should include affected data types', async () => {
      const incident = createMockIncident({
        affectedDataTypes: ['PASSWORD', 'PAYMENT'],
      });

      const report = await service.generateBreachReport(incident);

      expect(report).toContain('PASSWORD');
      expect(report).toContain('PAYMENT');
    });

    it('should show placeholder text when no remediation steps exist', async () => {
      const incident = createMockIncident({
        remediationSteps: [],
        recommendations: [],
      });

      const report = await service.generateBreachReport(incident);

      expect(report).toContain('No remediation steps recorded yet');
      expect(report).toContain('No recommendations recorded yet');
    });
  });

  // ─── getById ───────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return the incident when found', async () => {
      const incident = createMockIncident();
      mockBreachRepository.findOne.mockResolvedValue(incident);

      const result = await service.getById('incident-123');

      expect(result).toBe(incident);
      expect(mockBreachRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'incident-123' },
      });
    });

    it('should return null when not found', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── listIncidents ─────────────────────────────────────────────────────

  describe('listIncidents', () => {
    it('should return incidents ordered by discoveredAt DESC', async () => {
      const incidents = [createMockIncident({ id: 'a' }), createMockIncident({ id: 'b' })];
      mockBreachRepository.find.mockResolvedValue(incidents);

      const result = await service.listIncidents();

      expect(result).toHaveLength(2);
      expect(mockBreachRepository.find).toHaveBeenCalledWith({
        order: { discoveredAt: 'DESC' },
      });
    });

    it('should return empty array when no incidents exist', async () => {
      mockBreachRepository.find.mockResolvedValue([]);

      const result = await service.listIncidents();

      expect(result).toEqual([]);
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update status and save', async () => {
      const incident = createMockIncident();
      mockBreachRepository.findOne.mockResolvedValue(incident);
      mockBreachRepository.save.mockResolvedValue({ ...incident, status: 'CONTAINED' });

      const result = await service.updateStatus('incident-123', 'CONTAINED' as any);

      expect(result.status).toBe('CONTAINED');
      expect(mockBreachRepository.save).toHaveBeenCalled();
    });

    it('should set containedAt when status is CONTAINED', async () => {
      const incident = createMockIncident();
      mockBreachRepository.findOne.mockResolvedValue(incident);
      mockBreachRepository.save.mockImplementation((inc: any) => inc);

      await service.updateStatus('incident-123', 'CONTAINED' as any);

      expect(incident.containedAt).toBeInstanceOf(Date);
    });

    it('should set resolvedAt when status is RESOLVED', async () => {
      const incident = createMockIncident();
      mockBreachRepository.findOne.mockResolvedValue(incident);
      mockBreachRepository.save.mockImplementation((inc: any) => inc);

      await service.updateStatus('incident-123', 'RESOLVED' as any);

      expect(incident.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw when incident is not found', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('bad-id', 'CONTAINED' as any)).rejects.toThrow(
        'Incident not found',
      );
    });

    it('should not overwrite containedAt if already set', async () => {
      const existing = new Date('2026-01-01');
      const incident = createMockIncident({ containedAt: existing });
      mockBreachRepository.findOne.mockResolvedValue(incident);
      mockBreachRepository.save.mockImplementation((inc: any) => inc);

      await service.updateStatus('incident-123', 'CONTAINED' as any);

      expect(incident.containedAt).toBe(existing);
    });
  });

  // ─── addRemediationStep ────────────────────────────────────────────────

  describe('addRemediationStep', () => {
    it('should append a remediation step and save', async () => {
      const incident = createMockIncident();
      mockBreachRepository.findOne.mockResolvedValue(incident);
      mockBreachRepository.save.mockImplementation((inc: any) => inc);

      const result = await service.addRemediationStep('incident-123', 'Rotate all API keys');

      expect(result.remediationSteps).toContain('Rotate all API keys');
      expect(mockBreachRepository.save).toHaveBeenCalled();
    });

    it('should throw when incident is not found', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addRemediationStep('bad-id', 'some step'),
      ).rejects.toThrow('Incident not found');
    });
  });

  // ─── addRecommendation ─────────────────────────────────────────────────

  describe('addRecommendation', () => {
    it('should append a recommendation and save', async () => {
      const incident = createMockIncident();
      mockBreachRepository.findOne.mockResolvedValue(incident);
      mockBreachRepository.save.mockImplementation((inc: any) => inc);

      const result = await service.addRecommendation('incident-123', 'Enable MFA for all users');

      expect(result.recommendations).toContain('Enable MFA for all users');
      expect(mockBreachRepository.save).toHaveBeenCalled();
    });

    it('should throw when incident is not found', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addRecommendation('bad-id', 'some rec'),
      ).rejects.toThrow('Incident not found');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
