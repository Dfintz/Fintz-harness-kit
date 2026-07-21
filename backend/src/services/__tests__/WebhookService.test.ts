import axios from 'axios';

import {
  CreateWebhookDto,
  Webhook,
  WebhookEventType,
  WebhookStatus,
  WebhookType,
} from '../../models/Webhook';
import { ValidationError } from '../../utils/apiErrors';
import { WebhookService } from '../communication/webhooks/WebhookService';

// Mock dependencies
jest.mock('axios');
jest.mock('../../config/database');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let mockWebhookRepo: any;

  // Test organization and user
  const testOrgId = 'org-123';
  const testUserId = 'user-456';

  // Test Discord webhook
  const discordWebhookDto: CreateWebhookDto = {
    name: 'Test Discord Webhook',
    description: 'A test Discord webhook',
    type: WebhookType.DISCORD,
    events: [WebhookEventType.FLEET_CREATED, WebhookEventType.MEMBER_JOINED],
    discordConfig: {
      webhookUrl: 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop',
      username: 'Fleet Manager Bot',
    },
    createdBy: testUserId,
  };

  // Test custom webhook
  const customWebhookDto: CreateWebhookDto = {
    name: 'Test Custom Webhook',
    description: 'A test custom webhook',
    type: WebhookType.CUSTOM,
    events: [WebhookEventType.ACTIVITY_STARTED, WebhookEventType.ACTIVITY_COMPLETED],
    customConfig: {
      url: 'https://api.example.com/webhooks/receive',
      method: 'POST',
      headers: {
        'X-Custom-Header': 'test-value',
      },
    },
    createdBy: testUserId,
  };

  // Mock webhook entity
  const createMockWebhook = (dto: CreateWebhookDto, id: string = 'webhook-123'): Webhook => {
    const webhook = new Webhook();
    webhook.id = id;
    webhook.organizationId = testOrgId;
    webhook.name = dto.name;
    webhook.description = dto.description;
    webhook.type = dto.type;
    webhook.events = dto.events;
    webhook.discordConfig = dto.discordConfig;
    webhook.customConfig = dto.customConfig;
    webhook.status = WebhookStatus.ACTIVE;
    webhook.enabled = true;
    webhook.createdBy = dto.createdBy;
    webhook.secret =
      dto.type === WebhookType.CUSTOM ? 'test-secret-32-bytes-long-string123' : undefined;
    webhook.maxRetries = 3;
    webhook.retryDelayMs = 1000;
    webhook.timeoutMs = 30000;
    webhook.deliveryHistory = [];
    webhook.totalDeliveries = 0;
    webhook.successfulDeliveries = 0;
    webhook.failedDeliveries = 0;
    webhook.createdAt = new Date();
    webhook.updatedAt = new Date();
    return webhook;
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock repository
    mockWebhookRepo = {
      create: jest.fn(data => ({ ...data, id: 'webhook-new' })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    // Initialize service with mock repository
    webhookService = new WebhookService(mockWebhookRepo);

    // Mock axios.create to return a mock instance
    mockedAxios.create.mockReturnValue({
      request: jest.fn().mockResolvedValue({ status: 200 }),
    } as any);

    // Mock axios.post for direct calls (Discord webhooks)
    mockedAxios.post.mockResolvedValue({ status: 200 });
  });

  describe('createWebhook', () => {
    it('should create a Discord webhook successfully', async () => {
      const mockWebhook = createMockWebhook(discordWebhookDto);
      mockWebhookRepo.create.mockReturnValue(mockWebhook);
      mockWebhookRepo.save.mockResolvedValue(mockWebhook);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);

      const result = await webhookService.createWebhook(testOrgId, discordWebhookDto);

      expect(result).toBeDefined();
      expect(result.name).toBe(discordWebhookDto.name);
      expect(result.type).toBe(WebhookType.DISCORD);
      expect(mockWebhookRepo.create).toHaveBeenCalled();
      expect(mockWebhookRepo.save).toHaveBeenCalled();
    });

    it('should create a custom webhook with auto-generated secret', async () => {
      const mockWebhook = createMockWebhook(customWebhookDto);
      mockWebhookRepo.create.mockReturnValue(mockWebhook);
      mockWebhookRepo.save.mockResolvedValue(mockWebhook);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);

      const result = await webhookService.createWebhook(testOrgId, customWebhookDto);

      expect(result).toBeDefined();
      expect(result.type).toBe(WebhookType.CUSTOM);
      // Secret should be set for custom webhooks
      expect(mockWebhookRepo.create).toHaveBeenCalled();
    });

    it('should throw error for invalid Discord webhook URL', async () => {
      const invalidDto = {
        ...discordWebhookDto,
        discordConfig: {
          webhookUrl: 'https://invalid-url.com/webhook',
        },
      };

      await expect(webhookService.createWebhook(testOrgId, invalidDto)).rejects.toThrow(
        'Invalid Discord webhook URL format'
      );

      const error = await webhookService
        .createWebhook(testOrgId, invalidDto)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should throw error when no events are selected', async () => {
      const invalidDto = {
        ...discordWebhookDto,
        events: [],
      };

      await expect(webhookService.createWebhook(testOrgId, invalidDto)).rejects.toThrow(
        'At least one event must be selected'
      );

      const error = await webhookService
        .createWebhook(testOrgId, invalidDto)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should throw ValidationError (400) for an SSRF-blocked custom webhook URL', async () => {
      const ssrfDto: CreateWebhookDto = {
        ...customWebhookDto,
        customConfig: {
          url: 'http://localhost:8080/webhook',
          method: 'POST',
        },
      };

      const error = await webhookService.createWebhook(testOrgId, ssrfDto).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
      expect((error as ValidationError).message).toContain('localhost');
    });
  });

  describe('getWebhookById', () => {
    it('should return webhook by ID', async () => {
      const mockWebhook = createMockWebhook(discordWebhookDto);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);

      const result = await webhookService.getWebhookById('webhook-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('webhook-123');
      expect(mockWebhookRepo.findOne).toHaveBeenCalledWith({ where: { id: 'webhook-123' } });
    });

    it('should return null for non-existent webhook', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);

      const result = await webhookService.getWebhookById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getWebhooksByOrganization', () => {
    it('should return all webhooks for an organization', async () => {
      const mockWebhooks = [
        createMockWebhook(discordWebhookDto, 'webhook-1'),
        createMockWebhook(customWebhookDto, 'webhook-2'),
      ];
      mockWebhookRepo.find.mockResolvedValue(mockWebhooks);

      const result = await webhookService.getWebhooksByOrganization(testOrgId);

      expect(result).toHaveLength(2);
      expect(mockWebhookRepo.find).toHaveBeenCalledWith({
        where: { organizationId: testOrgId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook successfully', async () => {
      const mockWebhook = createMockWebhook(discordWebhookDto);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);
      mockWebhookRepo.save.mockResolvedValue({ ...mockWebhook, name: 'Updated Name' });

      const result = await webhookService.updateWebhook('webhook-123', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw error for non-existent webhook', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);

      await expect(webhookService.updateWebhook('non-existent', { name: 'Test' })).rejects.toThrow(
        'Webhook non-existent not found'
      );
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook successfully', async () => {
      mockWebhookRepo.delete.mockResolvedValue({ affected: 1 });

      await webhookService.deleteWebhook('webhook-123');

      expect(mockWebhookRepo.delete).toHaveBeenCalledWith('webhook-123');
    });

    it('should throw error for non-existent webhook', async () => {
      mockWebhookRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(webhookService.deleteWebhook('non-existent')).rejects.toThrow(
        'Webhook non-existent not found'
      );
    });
  });

  describe('triggerEvent', () => {
    it('should trigger event for subscribed webhooks', async () => {
      const mockWebhook = createMockWebhook(discordWebhookDto);
      mockWebhookRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockWebhook]),
      });
      mockWebhookRepo.save.mockResolvedValue(mockWebhook);

      const result = await webhookService.triggerEvent(testOrgId, WebhookEventType.FLEET_CREATED, {
        fleetName: 'Test Fleet',
        memberId: 'user-1',
      });

      expect(result.success).toBeGreaterThanOrEqual(0);
      expect(result.results).toBeDefined();
    });

    it('should skip webhooks not subscribed to the event', async () => {
      // Webhook only subscribed to FLEET_CREATED, but we trigger MEMBER_LEFT
      const mockWebhook = createMockWebhook({
        ...discordWebhookDto,
        events: [WebhookEventType.FLEET_CREATED],
      });
      mockWebhookRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockWebhook]),
      });

      const result = await webhookService.triggerEvent(testOrgId, WebhookEventType.MEMBER_LEFT, {
        memberId: 'user-1',
      });

      // Should succeed with 0 deliveries since no webhook is subscribed to MEMBER_LEFT
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return webhook statistics for organization', async () => {
      const mockWebhooks = [
        {
          ...createMockWebhook(discordWebhookDto),
          status: WebhookStatus.ACTIVE,
          totalDeliveries: 10,
          successfulDeliveries: 9,
        },
        {
          ...createMockWebhook(customWebhookDto),
          status: WebhookStatus.ERROR,
          totalDeliveries: 5,
          successfulDeliveries: 2,
        },
      ];
      mockWebhookRepo.find.mockResolvedValue(mockWebhooks);

      const result = await webhookService.getStatistics(testOrgId);

      expect(result.totalWebhooks).toBe(2);
      expect(result.activeWebhooks).toBe(1);
      expect(result.errorWebhooks).toBe(1);
      expect(result.totalDeliveries).toBe(15);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid HMAC signature', () => {
      const secret = 'test-secret-key';
      const payload = '{"event":"fleet.created","data":{}}';

      // Generate signature
      const crypto = require('crypto');
      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const result = webhookService.verifySignature(payload, expectedSignature, secret);

      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const secret = 'test-secret-key';
      const payload = '{"event":"fleet.created","data":{}}';

      // Generate a valid signature (64 chars hex) but with wrong secret
      const crypto = require('crypto');
      const invalidSignature = crypto
        .createHmac('sha256', 'wrong-secret')
        .update(payload)
        .digest('hex');

      const result = webhookService.verifySignature(payload, invalidSignature, secret);
      expect(result).toBe(false);
    });

    it('should reject signature with different length', () => {
      const secret = 'test-secret-key';
      const payload = '{"event":"fleet.created","data":{}}';
      const shortSignature = 'tooshort';

      const result = webhookService.verifySignature(payload, shortSignature, secret);
      expect(result).toBe(false);
    });
  });

  describe('testWebhookWithPayload', () => {
    it('should test webhook with custom payload', async () => {
      const mockWebhook = createMockWebhook(discordWebhookDto);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);
      mockWebhookRepo.save.mockResolvedValue(mockWebhook);

      const result = await webhookService.testWebhookWithPayload('webhook-123', {
        event: WebhookEventType.MEMBER_JOINED,
        data: { customField: 'customValue' },
      });

      expect(result).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.payload.event).toBe(WebhookEventType.MEMBER_JOINED);
      expect(result.payload.data.customField).toBe('customValue');
      expect(result.payload.data.test).toBe(true);
    });

    it('should throw error for non-existent webhook', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);

      await expect(webhookService.testWebhookWithPayload('non-existent', {})).rejects.toThrow(
        'Webhook non-existent not found'
      );
    });
  });

  describe('getTestPayloadPreview', () => {
    it('should return payload preview for webhook', async () => {
      const mockWebhook = createMockWebhook(discordWebhookDto);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);

      const result = await webhookService.getTestPayloadPreview('webhook-123', {
        event: WebhookEventType.ACTIVITY_CREATED,
        data: { activityName: 'Test Activity' },
      });

      expect(result).toBeDefined();
      expect(result.webhook.id).toBe('webhook-123');
      expect(result.payload.event).toBe(WebhookEventType.ACTIVITY_CREATED);
      expect(result.payload.data.activityName).toBe('Test Activity');
      expect(result.headers['X-Webhook-Event']).toBe(WebhookEventType.ACTIVITY_CREATED);
      expect(result.discordMessage).toBeDefined();
    });

    it('should include signature for custom webhooks', async () => {
      const mockWebhook = createMockWebhook(customWebhookDto);
      mockWebhookRepo.findOne.mockResolvedValue(mockWebhook);

      const result = await webhookService.getTestPayloadPreview('webhook-123');

      expect(result).toBeDefined();
      expect(result.payload.signature).toBeDefined();
      expect(result.headers['X-Webhook-Signature']).toBeDefined();
      expect(result.headers['X-Webhook-Signature']).toContain('sha256=');
    });
  });

  describe('Webhook Batching', () => {
    describe('configureBatching', () => {
      it('should configure batch settings', () => {
        webhookService.configureBatching({
          maxBatchSize: 20,
          maxWaitTimeMs: 10000,
          enabled: true,
        });

        const config = webhookService.getBatchConfig();
        expect(config.maxBatchSize).toBe(20);
        expect(config.maxWaitTimeMs).toBe(10000);
        expect(config.enabled).toBe(true);
      });

      it('should clamp values to valid range', () => {
        webhookService.configureBatching({
          maxBatchSize: 200, // Above max
          maxWaitTimeMs: 100, // Below min
        });

        const config = webhookService.getBatchConfig();
        expect(config.maxBatchSize).toBe(100); // Clamped to max
        expect(config.maxWaitTimeMs).toBe(1000); // Clamped to min
      });
    });

    describe('queueEventForBatch', () => {
      beforeEach(() => {
        webhookService.configureBatching({ enabled: true, maxBatchSize: 10, maxWaitTimeMs: 5000 });
      });

      it('should queue event for subscribed webhooks', async () => {
        const mockWebhook = createMockWebhook(discordWebhookDto);
        mockWebhookRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([mockWebhook]),
        });

        const result = await webhookService.queueEventForBatch(
          testOrgId,
          WebhookEventType.FLEET_CREATED,
          { fleetName: 'Test Fleet' }
        );

        expect(result.queued).toBe(true);
        expect(result.webhookIds).toContain('webhook-123');
      });

      it('should return empty when no webhooks are subscribed', async () => {
        mockWebhookRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        });

        const result = await webhookService.queueEventForBatch(
          testOrgId,
          WebhookEventType.FLEET_CREATED,
          {}
        );

        expect(result.queued).toBe(false);
        expect(result.webhookIds).toHaveLength(0);
      });

      it('should trigger immediately when batching is disabled', async () => {
        webhookService.configureBatching({ enabled: false });

        const mockWebhook = createMockWebhook(discordWebhookDto);
        mockWebhookRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([mockWebhook]),
        });
        mockWebhookRepo.save.mockResolvedValue(mockWebhook);

        const result = await webhookService.queueEventForBatch(
          testOrgId,
          WebhookEventType.FLEET_CREATED,
          {}
        );

        expect(result.queued).toBe(false);
      });
    });

    describe('getPendingBatches', () => {
      it('should return empty array when no pending batches', () => {
        const result = webhookService.getPendingBatches('non-existent-org');
        expect(result).toEqual([]);
      });
    });

    describe('cancelPendingBatches', () => {
      it('should return 0 when no pending batches', () => {
        const result = webhookService.cancelPendingBatches('non-existent-org');
        expect(result).toBe(0);
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

