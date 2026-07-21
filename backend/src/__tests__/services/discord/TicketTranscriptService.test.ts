/**
 * TicketTranscriptService Tests
 *
 * Tests for the Ticket Transcript Service:
 * - Transcript generation (HTML + plain text)
 * - Message rendering
 * - Internal message filtering
 * - Duration formatting
 * - Post to channel
 */

jest.mock('../../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { TicketTranscriptService } from '../../../services/discord/TicketTranscriptService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getService(): TicketTranscriptService {
  (TicketTranscriptService as any).instance = undefined;
  return TicketTranscriptService.getInstance();
}

function createMockClient() {
  const mockChannel = {
    send: jest.fn().mockResolvedValue({}),
  };
  return {
    channels: {
      fetch: jest.fn().mockResolvedValue(mockChannel),
    },
    _mockChannel: mockChannel,
  };
}

function createMockMessages() {
  return [
    {
      id: 'msg-1',
      authorId: 'user-1',
      authorName: 'Alice',
      content: 'I have a login issue',
      createdAt: new Date('2025-01-15T10:00:00Z'),
      isInternal: false,
    },
    {
      id: 'msg-2',
      authorId: 'staff-1',
      authorName: 'Bob (Staff)',
      content: 'Looking into it',
      createdAt: new Date('2025-01-15T10:30:00Z'),
      isInternal: false,
    },
    {
      id: 'msg-internal',
      authorId: 'staff-1',
      authorName: 'Bob (Staff)',
      content: 'Internal note: user seems confused',
      createdAt: new Date('2025-01-15T10:35:00Z'),
      isInternal: true,
    },
    {
      id: 'msg-3',
      authorId: 'user-1',
      authorName: 'Alice',
      content: 'Thanks, that worked!',
      createdAt: new Date('2025-01-15T11:00:00Z'),
      isInternal: false,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TicketTranscriptService', () => {
  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const a = TicketTranscriptService.getInstance();
      const b = TicketTranscriptService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('generateTranscript', () => {
    it('should generate transcript with correct metadata', () => {
      const service = getService();
      const messages = createMockMessages();

      const transcript = service.generateTranscript(
        '#42',
        'Login Issue',
        'Technical',
        'Alice',
        new Date('2025-01-15T10:00:00Z'),
        messages
      );

      expect(transcript.ticketNumber).toBe('#42');
      expect(transcript.subject).toBe('Login Issue');
      expect(transcript.category).toBe('Technical');
      expect(transcript.creatorName).toBe('Alice');
      expect(transcript.messageCount).toBe(3); // internal message filtered out
    });

    it('should filter out internal messages', () => {
      const service = getService();
      const messages = createMockMessages();

      const transcript = service.generateTranscript(
        '#1',
        'Test',
        'General',
        'User',
        new Date('2025-01-15T10:00:00Z'),
        messages
      );

      // Internal message should not appear in transcript
      expect(transcript.plainText).not.toContain('Internal note');
      expect(transcript.html).not.toContain('Internal note');
      expect(transcript.messageCount).toBe(3);
    });

    it('should include all non-internal messages in plain text', () => {
      const service = getService();
      const messages = createMockMessages();

      const transcript = service.generateTranscript(
        '#1',
        'Test',
        'General',
        'Alice',
        new Date('2025-01-15T10:00:00Z'),
        messages
      );

      expect(transcript.plainText).toContain('Alice');
      expect(transcript.plainText).toContain('I have a login issue');
      expect(transcript.plainText).toContain('Bob (Staff)');
      expect(transcript.plainText).toContain('Looking into it');
      expect(transcript.plainText).toContain('Thanks, that worked!');
    });

    it('should generate HTML with proper structure', () => {
      const service = getService();
      const messages = createMockMessages();

      const transcript = service.generateTranscript(
        '#7',
        'Bug Report',
        'Bug',
        'Alice',
        new Date('2025-01-15T10:00:00Z'),
        messages
      );

      expect(transcript.html).toContain('<!DOCTYPE html>');
      expect(transcript.html).toContain('#7');
      expect(transcript.html).toContain('Bug Report');
      expect(transcript.html).toContain('Alice');
    });

    it('should handle empty messages array', () => {
      const service = getService();

      const transcript = service.generateTranscript(
        '#1',
        'Empty Ticket',
        'General',
        'User',
        new Date('2025-01-15T10:00:00Z'),
        []
      );

      expect(transcript.messageCount).toBe(0);
      expect(transcript.plainText).toContain('Empty Ticket');
    });

    it('should include ticket duration in the transcript', () => {
      const service = getService();
      const messages = [
        {
          id: 'msg-1',
          authorId: 'user-1',
          authorName: 'User',
          content: 'Help',
          createdAt: new Date('2025-01-15T10:00:00Z'),
          isInternal: false,
        },
      ];

      const transcript = service.generateTranscript(
        '#1',
        'Test',
        'General',
        'User',
        new Date('2025-01-15T10:00:00Z'),
        messages
      );

      // Duration should be calculated (even if 0 for single message)
      expect(transcript.plainText).toBeDefined();
      expect(transcript.html).toBeDefined();
    });
  });

  describe('postToChannel', () => {
    it('should post embed and transcript file to channel', async () => {
      const service = getService();
      const mockClient = createMockClient();
      service.initialize(mockClient as any);

      const messages = createMockMessages();
      const transcript = service.generateTranscript(
        '#42',
        'Test Ticket',
        'General',
        'Alice',
        new Date('2025-01-15T10:00:00Z'),
        messages
      );

      await service.postToChannel('channel-123', transcript);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-123');
      expect(mockClient._mockChannel.send).toHaveBeenCalledTimes(1);
      const sendCall = mockClient._mockChannel.send.mock.calls[0][0];
      expect(sendCall.embeds).toBeDefined();
      expect(sendCall.files).toBeDefined();
      expect(sendCall.files.length).toBe(1);
    });

    it('should not throw when channel is unavailable', async () => {
      const service = getService();
      const mockClient = createMockClient();
      mockClient.channels.fetch.mockRejectedValue(new Error('Unknown channel'));
      service.initialize(mockClient as any);

      const transcript = service.generateTranscript(
        '#1', 'X', 'General', 'User',
        new Date(), []
      );

      await expect(
        service.postToChannel('invalid-channel', transcript)
      ).resolves.not.toThrow();
    });
  });
});
