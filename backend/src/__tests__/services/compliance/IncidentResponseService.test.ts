// Mock logger before imports
jest.mock('../../../utils/auditLogger');

import { AppDataSource } from '../../../config/database';
import { DataBreachNotification } from '../../../models/DataBreachNotification';
import { User } from '../../../models/User';
import { NotificationService } from '../../../services/communication/notifications/NotificationService';
import {
  BreachReport,
  IncidentResponseService,
} from '../../../services/compliance/IncidentResponseService';
import { NotFoundError } from '../../../utils/apiErrors';

// Mock AppDataSource
jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('IncidentResponseService', () => {
  let service: IncidentResponseService;
  let mockBreachRepository: any;
  let mockUserRepository: any;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock environment variables
    process.env.APP_URL = 'https://test.example.com';
    process.env.SECURITY_EMAIL = 'security@test.com';
    process.env.LEGAL_EMAIL = 'legal@test.com';

    // Mock repositories
    mockBreachRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    // Mock NotificationService
    mockNotificationService = {
      sendEmailNotification: jest.fn().mockResolvedValue({
        success: true,
        channel: 'email',
        recipientCount: 1,
      }),
    } as any;

    // Setup AppDataSource mock
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === DataBreachNotification) {
        return mockBreachRepository;
      }
      if (entity === User) {
        return mockUserRepository;
      }
      return {};
    });

    service = new IncidentResponseService(mockNotificationService);
  });

  describe('reportBreach', () => {
    it('should create and save a new incident', async () => {
      const breachReport: BreachReport = {
        title: 'Test Breach',
        description: 'Test description',
        severity: 'high',
        affectedUsers: ['user-1', 'user-2'],
        affectedDataTypes: ['EMAIL', 'USERNAME'],
      };

      const mockIncident = {
        id: 'incident-1',
        ...breachReport,
        status: 'INVESTIGATING',
        discoveredAt: new Date(),
        notifiedUsers: [],
        notificationErrors: [],
        remediationSteps: [],
        recommendations: [],
      };

      mockBreachRepository.save.mockResolvedValue(mockIncident);

      const result = await service.reportBreach(breachReport);

      expect(result).toBeDefined();
      expect(result.title).toBe(breachReport.title);
      expect(result.status).toBe('INVESTIGATING');
      expect(mockBreachRepository.save).toHaveBeenCalled();
    });

    it('should notify admins for critical severity', async () => {
      const breachReport: BreachReport = {
        title: 'Critical Breach',
        description: 'Critical issue',
        severity: 'critical',
        affectedUsers: ['user-1'],
        affectedDataTypes: ['PASSWORD'],
      };

      const mockAdmin = {
        id: 'admin-1',
        email: 'admin@test.com',
        username: 'admin',
        role: 'admin',
      };

      const mockIncident = {
        id: 'incident-1',
        ...breachReport,
        status: 'INVESTIGATING',
        discoveredAt: new Date(),
        notifiedUsers: [],
        notificationErrors: [],
        remediationSteps: [],
        recommendations: [],
      };

      mockBreachRepository.save.mockResolvedValue(mockIncident);
      mockUserRepository.find.mockResolvedValue([mockAdmin]);

      await service.reportBreach(breachReport);

      expect(mockUserRepository.find).toHaveBeenCalledWith({ where: { role: 'admin' } });
      expect(mockNotificationService.sendEmailNotification).toHaveBeenCalled();
    });

    it('should not notify admins for non-critical severity', async () => {
      const breachReport: BreachReport = {
        title: 'Medium Breach',
        description: 'Medium issue',
        severity: 'medium',
        affectedUsers: ['user-1'],
        affectedDataTypes: ['EMAIL'],
      };

      const mockIncident = {
        id: 'incident-1',
        ...breachReport,
        status: 'INVESTIGATING',
        discoveredAt: new Date(),
        notifiedUsers: [],
        notificationErrors: [],
        remediationSteps: [],
        recommendations: [],
      };

      mockBreachRepository.save.mockResolvedValue(mockIncident);

      await service.reportBreach(breachReport);

      expect(mockNotificationService.sendEmailNotification).not.toHaveBeenCalled();
    });
  });

  describe('notifyAffectedUsers', () => {
    it('should notify all affected users', async () => {
      const mockUser1 = {
        id: 'user-1',
        username: 'user1',
        email: 'user1@test.com',
      };

      const mockUser2 = {
        id: 'user-2',
        username: 'user2',
        email: 'user2@test.com',
      };

      const incident = new DataBreachNotification();
      incident.id = 'incident-1';
      incident.title = 'Test Breach';
      incident.description = 'Test';
      incident.severity = 'high';
      incident.affectedUsers = ['user-1', 'user-2'];
      incident.affectedDataTypes = ['EMAIL'];
      incident.status = 'INVESTIGATING';
      incident.notifiedUsers = [];
      incident.notificationErrors = [];
      incident.remediationSteps = [];
      incident.recommendations = [];

      mockUserRepository.findOne.mockResolvedValueOnce(mockUser1).mockResolvedValueOnce(mockUser2);

      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(mockNotificationService.sendEmailNotification).toHaveBeenCalledTimes(2);
      expect(incident.notifiedUsers).toHaveLength(2);
      expect(incident.status).toBe('NOTIFIED');
      expect(mockBreachRepository.save).toHaveBeenCalled();
    });

    it('should handle notification failures gracefully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'user1',
        email: 'user1@test.com',
      };

      const incident = new DataBreachNotification();
      incident.id = 'incident-1';
      incident.title = 'Test Breach';
      incident.description = 'Test';
      incident.severity = 'high';
      incident.affectedUsers = ['user-1'];
      incident.affectedDataTypes = ['EMAIL'];
      incident.status = 'INVESTIGATING';
      incident.notifiedUsers = [];
      incident.notificationErrors = [];
      incident.remediationSteps = [];
      incident.recommendations = [];

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockNotificationService.sendEmailNotification.mockRejectedValue(
        new Error('Email service unavailable')
      );

      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(incident.notificationErrors).toHaveLength(1);
      expect(incident.notificationErrors[0].error).toBe('Email service unavailable');
      expect(incident.status).toBe('NOTIFIED');
    });

    it('should skip users without email addresses', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'user1',
        email: undefined,
      };

      const incident = new DataBreachNotification();
      incident.id = 'incident-1';
      incident.title = 'Test Breach';
      incident.description = 'Test';
      incident.severity = 'high';
      incident.affectedUsers = ['user-1'];
      incident.affectedDataTypes = ['EMAIL'];
      incident.status = 'INVESTIGATING';
      incident.notifiedUsers = [];
      incident.notificationErrors = [];
      incident.remediationSteps = [];
      incident.recommendations = [];

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockBreachRepository.save.mockResolvedValue(incident);

      await service.notifyAffectedUsers(incident);

      expect(mockNotificationService.sendEmailNotification).not.toHaveBeenCalled();
      expect(incident.notifiedUsers).toHaveLength(0);
    });
  });

  describe('generateBreachReport', () => {
    it('should generate a formatted breach report', async () => {
      const incident = new DataBreachNotification();
      incident.id = 'incident-1';
      incident.title = 'Test Breach';
      incident.description = 'Test description';
      incident.severity = 'critical';
      incident.affectedUsers = ['user-1', 'user-2'];
      incident.affectedDataTypes = ['PASSWORD', 'EMAIL'];
      incident.status = 'RESOLVED';
      incident.discoveredAt = new Date('2026-01-11T00:00:00Z');
      incident.notifiedAt = new Date('2026-01-11T02:00:00Z');
      incident.notifiedUsers = [
        { userId: 'user-1', notifiedAt: new Date(), status: 'SENT' },
        { userId: 'user-2', notifiedAt: new Date(), status: 'SENT' },
      ];
      incident.notificationErrors = [];
      incident.remediationSteps = ['Step 1', 'Step 2'];
      incident.recommendations = ['Recommendation 1'];

      const report = await service.generateBreachReport(incident);

      expect(report).toContain('INCIDENT REPORT');
      expect(report).toContain('incident-1');
      expect(report).toContain('Test Breach');
      expect(report).toContain('Affected Users: 2');
      expect(report).toContain('PASSWORD, EMAIL');
      expect(report).toContain('Step 1');
      expect(report).toContain('Step 2');
      expect(report).toContain('Recommendation 1');
    });

    it('should handle incidents without remediation steps', async () => {
      const incident = new DataBreachNotification();
      incident.id = 'incident-1';
      incident.title = 'Test Breach';
      incident.description = 'Test';
      incident.severity = 'low';
      incident.affectedUsers = ['user-1'];
      incident.affectedDataTypes = ['EMAIL'];
      incident.status = 'INVESTIGATING';
      incident.discoveredAt = new Date();
      incident.notifiedUsers = [];
      incident.notificationErrors = [];
      incident.remediationSteps = [];
      incident.recommendations = [];

      const report = await service.generateBreachReport(incident);

      expect(report).toContain('No remediation steps recorded yet');
      expect(report).toContain('No recommendations recorded yet');
    });
  });

  describe('getById', () => {
    it('should retrieve incident by ID', async () => {
      const mockIncident = {
        id: 'incident-1',
        title: 'Test Breach',
      };

      mockBreachRepository.findOne.mockResolvedValue(mockIncident);

      const result = await service.getById('incident-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('incident-1');
      expect(mockBreachRepository.findOne).toHaveBeenCalledWith({ where: { id: 'incident-1' } });
    });

    it('should return null for non-existent incident', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      const result = await service.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listIncidents', () => {
    it('should list all incidents ordered by discovery date', async () => {
      const mockIncidents = [
        { id: 'incident-1', discoveredAt: new Date('2026-01-11') },
        { id: 'incident-2', discoveredAt: new Date('2026-01-10') },
      ];

      mockBreachRepository.find.mockResolvedValue(mockIncidents);

      const result = await service.listIncidents();

      expect(result).toHaveLength(2);
      expect(mockBreachRepository.find).toHaveBeenCalledWith({
        order: { discoveredAt: 'DESC' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update incident status', async () => {
      const mockIncident = {
        id: 'incident-1',
        status: 'INVESTIGATING',
        containedAt: undefined,
      };

      mockBreachRepository.findOne.mockResolvedValue(mockIncident);
      mockBreachRepository.save.mockImplementation(incident => Promise.resolve(incident));

      const result = await service.updateStatus('incident-1', 'CONTAINED');

      expect(result.status).toBe('CONTAINED');
      expect(result.containedAt).toBeDefined();
    });

    it('should throw error for non-existent incident', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', 'CONTAINED')).rejects.toThrow(
        'Incident not found'
      );

      const error = await service
        .updateStatus('non-existent', 'CONTAINED')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('should set resolvedAt when status is RESOLVED', async () => {
      const mockIncident = {
        id: 'incident-1',
        status: 'NOTIFIED',
        resolvedAt: undefined,
      };

      mockBreachRepository.findOne.mockResolvedValue(mockIncident);
      mockBreachRepository.save.mockImplementation(incident => Promise.resolve(incident));

      const result = await service.updateStatus('incident-1', 'RESOLVED');

      expect(result.status).toBe('RESOLVED');
      expect(result.resolvedAt).toBeDefined();
    });
  });

  describe('addRemediationStep', () => {
    it('should add remediation step to incident', async () => {
      const mockIncident = {
        id: 'incident-1',
        remediationSteps: ['Step 1'],
      };

      mockBreachRepository.findOne.mockResolvedValue(mockIncident);
      mockBreachRepository.save.mockResolvedValue({
        ...mockIncident,
        remediationSteps: ['Step 1', 'Step 2'],
      });

      const result = await service.addRemediationStep('incident-1', 'Step 2');

      expect(result.remediationSteps).toContain('Step 2');
    });

    it('should throw error for non-existent incident', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      await expect(service.addRemediationStep('non-existent', 'Step')).rejects.toThrow(
        'Incident not found'
      );

      const error = await service
        .addRemediationStep('non-existent', 'Step')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

  describe('addRecommendation', () => {
    it('should add recommendation to incident', async () => {
      const mockIncident = {
        id: 'incident-1',
        recommendations: ['Rec 1'],
      };

      mockBreachRepository.findOne.mockResolvedValue(mockIncident);
      mockBreachRepository.save.mockResolvedValue({
        ...mockIncident,
        recommendations: ['Rec 1', 'Rec 2'],
      });

      const result = await service.addRecommendation('incident-1', 'Rec 2');

      expect(result.recommendations).toContain('Rec 2');
    });

    it('should throw error for non-existent incident', async () => {
      mockBreachRepository.findOne.mockResolvedValue(null);

      await expect(service.addRecommendation('non-existent', 'Rec')).rejects.toThrow(
        'Incident not found'
      );

      const error = await service.addRecommendation('non-existent', 'Rec').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });
});
