import crypto from 'crypto';

import { Repository } from 'typeorm';

import {
  Webhook,
  WebhookType,
  WebhookStatus,
  WebhookEventType,
  CreateWebhookDto,
  UpdateWebhookDto,
} from '../../../../models/Webhook';
import { WebhookService } from '../WebhookService';

// Mock dependencies
jest.mock('../../../../config/database');
jest.mock('axios');

describe('WebhookService', () => {
  let service: WebhookService;
  let mockRepository: jest.Mocked<Repository<Webhook>>;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new WebhookService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWebhook', () => {
    const organizationId = 'org-123';
    const mockDto: CreateWebhookDto = {
      name: 'Test Webhook',
      description: 'Test webhook description',
      type: WebhookType.DISCORD,
      events: [WebhookEventType.ANNOUNCEMENT_CREATED],
      discordConfig: {
        webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      },
    };

    it('should create a Discord webhook', async () => {
      const mockWebhook = {
        id: 'webhook-1',
        organizationId,
        ...mockDto,
        status: WebhookStatus.PENDING,
      } as Webhook;

      mockRepository.create.mockReturnValue(mockWebhook);
      mockRepository.save.mockResolvedValue(mockWebhook);

      const result = await service.createWebhook(organizationId, mockDto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId,
          name: mockDto.name,
          type: mockDto.type,
          status: WebhookStatus.PENDING,
        })
      );
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockWebhook);
    });

    it('should generate secret for custom webhooks', async () => {
      const customDto: CreateWebhookDto = {
        ...mockDto,
        type: WebhookType.CUSTOM,
        customConfig: {
          url: 'https://example.com/webhook',
          method: 'POST',
        },
      };

      const mockWebhook = {
        id: 'webhook-2',
        organizationId,
        ...customDto,
        secret: expect.any(String),
      } as Webhook;

      mockRepository.create.mockReturnValue(mockWebhook);
      mockRepository.save.mockResolvedValue(mockWebhook);

      const result = await service.createWebhook(organizationId, customDto);

      // Secret should be generated (32 bytes = 64 hex chars)
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: expect.any(String),
        })
      );
    });
  });

  describe('HMAC signature', () => {
    // Note: We intentionally test the private generateSignature() method directly
    // because HMAC signature generation is security-critical and we need to verify
    // the exact implementation details (SHA-256, hex encoding, etc.)

    it('should generate correct HMAC signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret-key';

      const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      // Call private method via service instance
      const signature = (service as any).generateSignature(payload, secret);

      expect(signature).toBe(expectedSignature);
    });

    it('should produce different signatures for different payloads', () => {
      const secret = 'test-secret-key';
      const payload1 = JSON.stringify({ test: 'data1' });
      const payload2 = JSON.stringify({ test: 'data2' });

      const signature1 = (service as any).generateSignature(payload1, secret);
      const signature2 = (service as any).generateSignature(payload2, secret);

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different secrets', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret1 = 'secret-1';
      const secret2 = 'secret-2';

      const signature1 = (service as any).generateSignature(payload, secret1);
      const signature2 = (service as any).generateSignature(payload, secret2);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('SSRF protection', () => {
    // Note: We intentionally test the private validateUrlForSSRF() method directly
    // because SSRF protection is security-critical and we need to verify it correctly
    // blocks private IPs, localhost, and other dangerous URLs

    it('should prevent webhooks to private IP addresses', () => {
      const privateIPs = [
        'http://192.168.1.1/webhook',
        'http://10.0.0.1/webhook',
        'http://172.16.0.1/webhook',
      ];

      privateIPs.forEach(url => {
        expect(() => {
          (service as any).validateUrlForSSRF(url);
        }).toThrow();
      });
    });

    it('should prevent webhooks to localhost', () => {
      const localhostUrls = [
        'http://localhost/webhook',
        'http://127.0.0.1/webhook',
        'http://0.0.0.0/webhook',
      ];

      localhostUrls.forEach(url => {
        expect(() => {
          (service as any).validateUrlForSSRF(url);
        }).toThrow();
      });
    });

    it('should allow webhooks to valid external URLs', () => {
      const validUrls = [
        'https://example.com/webhook',
        'https://api.slack.com/webhook',
        'https://discord.com/api/webhooks/123/abc',
      ];

      validUrls.forEach(url => {
        expect(() => {
          (service as any).validateUrlForSSRF(url);
        }).not.toThrow();
      });
    });
  });

  describe('getWebhook', () => {
    it('should retrieve webhook by ID', async () => {
      const mockWebhook = {
        id: 'webhook-1',
        name: 'Test Webhook',
      } as Webhook;

      mockRepository.findOne.mockResolvedValue(mockWebhook);

      const result = await service.getWebhook('webhook-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'webhook-1' },
      });
      expect(result).toEqual(mockWebhook);
    });

    it('should return null if webhook not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getWebhook('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listWebhooks', () => {
    it('should list webhooks for organization', async () => {
      const organizationId = 'org-123';
      const mockWebhooks = [
        { id: 'webhook-1', name: 'Webhook 1' },
        { id: 'webhook-2', name: 'Webhook 2' },
      ] as Webhook[];

      mockRepository.find.mockResolvedValue(mockWebhooks);

      const result = await service.listWebhooks(organizationId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId },
        })
      );
      expect(result).toEqual(mockWebhooks);
    });

    it('should filter by status if provided', async () => {
      const organizationId = 'org-123';
      const status = WebhookStatus.ACTIVE;

      mockRepository.find.mockResolvedValue([]);

      await service.listWebhooks(organizationId, status);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId, status },
        })
      );
    });
  });

  describe('deleteWebhook', () => {
    it('should delete webhook by ID', async () => {
      const webhookId = 'webhook-1';
      const mockWebhook = { id: webhookId } as Webhook;

      mockRepository.findOne.mockResolvedValue(mockWebhook);
      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteWebhook(webhookId);

      expect(mockRepository.delete).toHaveBeenCalledWith(webhookId);
    });
  });

  describe('updateWebhook', () => {
    const webhookId = 'webhook-1';
    const mockDto: UpdateWebhookDto = {
      name: 'Updated Webhook',
      status: WebhookStatus.ACTIVE,
    };

    it('should update webhook', async () => {
      const existingWebhook = {
        id: webhookId,
        name: 'Old Name',
        status: WebhookStatus.PENDING,
      } as Webhook;

      const updatedWebhook = {
        ...existingWebhook,
        ...mockDto,
      } as Webhook;

      mockRepository.findOne.mockResolvedValue(existingWebhook);
      mockRepository.save.mockResolvedValue(updatedWebhook);

      const result = await service.updateWebhook(webhookId, mockDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: webhookId },
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe(mockDto.name);
    });

    it('should throw error if webhook not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateWebhook(webhookId, mockDto)).rejects.toThrow();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

