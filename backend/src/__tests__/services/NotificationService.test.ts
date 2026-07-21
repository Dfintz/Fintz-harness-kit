// Mock logger before any imports
import { Client, EmbedBuilder, TextChannel, User, DMChannel } from 'discord.js';
import nodemailer from 'nodemailer';

// Mock nodemailer only (not discord.js, we want real EmbedBuilder)
jest.mock('nodemailer');

import {
  NotificationService,
  NotificationMessage,
  EmailConfig,
  NotificationResult,
} from '../../services/communication';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockDiscordClient: jest.Mocked<Client>;
  let mockEmailTransporter: jest.Mocked<nodemailer.Transporter>;
  let mockChannel: jest.Mocked<TextChannel>;
  let mockUser: jest.Mocked<User>;
  let emailConfig: EmailConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Discord channel with proper instanceof support
    mockChannel = Object.create(TextChannel.prototype);
    mockChannel.send = jest.fn().mockResolvedValue({});
    mockChannel.fetch = jest.fn() as any;

    // Mock Discord user
    mockUser = {
      send: jest.fn().mockResolvedValue({}),
    } as any;

    // Mock Discord client
    mockDiscordClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
      users: {
        fetch: jest.fn().mockResolvedValue(mockUser),
      },
      isReady: jest.fn().mockReturnValue(true),
    } as any;

    // Mock email transporter
    mockEmailTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
      verify: jest.fn().mockResolvedValue(true),
    } as any;

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockEmailTransporter);

    // Email configuration
    emailConfig = {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@test.com',
        pass: 'password',
      },
      from: 'noreply@fleet-manager.com',
    };
  });

  describe('Constructor', () => {
    it('should initialize with Discord client only', () => {
      service = new NotificationService(mockDiscordClient);
      expect(service).toBeDefined();
    });

    it('should initialize with email config only', () => {
      service = new NotificationService(undefined, emailConfig);
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
      });
    });

    it('should initialize with both Discord and email', () => {
      service = new NotificationService(mockDiscordClient, emailConfig, 'default-channel-id');
      expect(service).toBeDefined();
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should initialize without any configuration', () => {
      service = new NotificationService();
      expect(service).toBeDefined();
    });
  });

  describe('sendDiscordNotification', () => {
    beforeEach(() => {
      service = new NotificationService(mockDiscordClient, undefined, 'default-channel-123');
    });

    it('should send text message to channel successfully', async () => {
      const message: NotificationMessage = {
        subject: 'Test Subject',
        body: 'Test notification body',
      };

      const result = await service.sendDiscordNotification(message);

      expect(mockDiscordClient.channels.fetch).toHaveBeenCalledWith('default-channel-123');
      expect(mockChannel.send).toHaveBeenCalledWith('Test notification body');
      expect(result).toEqual({
        success: true,
        channel: 'discord',
        recipientCount: 0,
      });
    });

    it('should send embed message to channel', async () => {
      const embed = new EmbedBuilder().setTitle('Test Embed');
      const message: NotificationMessage = {
        subject: 'Test Subject',
        body: 'Test body',
        embed,
      };

      const result = await service.sendDiscordNotification(message);

      expect(mockChannel.send).toHaveBeenCalledWith({ embeds: [embed] });
      expect(result.success).toBe(true);
    });

    it('should send message to custom channel when channelId provided', async () => {
      const customChannelId = 'custom-channel-456';
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test message',
      };

      await service.sendDiscordNotification(message, customChannelId);

      expect(mockDiscordClient.channels.fetch).toHaveBeenCalledWith(customChannelId);
    });

    it('should send DMs to specified users', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test DM',
        recipientIds: ['user-1', 'user-2', 'user-3'],
      };

      const result = await service.sendDiscordNotification(message);

      expect(mockDiscordClient.users.fetch).toHaveBeenCalledTimes(3);
      expect(mockUser.send).toHaveBeenCalledTimes(3);
      expect(mockUser.send).toHaveBeenCalledWith('Test DM');
      expect(result.recipientCount).toBe(3);
    });

    it('should send embeds via DM to users', async () => {
      const embed = new EmbedBuilder().setTitle('DM Embed');
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test body',
        embed,
        recipientIds: ['user-1'],
      };

      await service.sendDiscordNotification(message);

      expect(mockUser.send).toHaveBeenCalledWith({ embeds: [embed] });
    });

    it('should handle DM failures gracefully', async () => {
      mockDiscordClient.users.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockUser)
        .mockRejectedValueOnce(new Error('User not found'))
        .mockResolvedValueOnce(mockUser);

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientIds: ['user-1', 'user-2', 'user-3'],
      };

      const result = await service.sendDiscordNotification(message);

      expect(result.success).toBe(true);
      expect(result.recipientCount).toBe(2); // Only 2 succeeded
    });

    it('should fail when Discord client not configured', async () => {
      service = new NotificationService(); // No Discord client

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const result = await service.sendDiscordNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Discord client not configured');
    });

    it('should fail when no channel ID specified', async () => {
      service = new NotificationService(mockDiscordClient); // No default channel

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const result = await service.sendDiscordNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No Discord channel specified');
    });

    it('should fail when channel is invalid', async () => {
      mockDiscordClient.channels.fetch = jest.fn().mockResolvedValue(null);

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const result = await service.sendDiscordNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Discord channel');
    });

    it('should fail when channel is not a TextChannel', async () => {
      const voiceChannel = { type: 'GUILD_VOICE' } as any;
      mockDiscordClient.channels.fetch = jest.fn().mockResolvedValue(voiceChannel);

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const result = await service.sendDiscordNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Discord channel');
    });

    it('should handle channel send failure', async () => {
      mockChannel.send = jest.fn().mockRejectedValue(new Error('Send failed'));

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const result = await service.sendDiscordNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });
  });

  describe('sendEmailNotification', () => {
    beforeEach(() => {
      service = new NotificationService(undefined, emailConfig);
    });

    it('should send email successfully', async () => {
      const message: NotificationMessage = {
        subject: 'Test Email',
        body: 'Email body content',
        recipientEmails: ['user1@test.com', 'user2@test.com'],
      };

      const result = await service.sendEmailNotification(message);

      expect(mockEmailTransporter.sendMail).toHaveBeenCalledWith({
        from: emailConfig.from,
        to: 'user1@test.com, user2@test.com',
        subject: 'Test Email',
        text: 'Email body content',
        html: expect.stringContaining('Email body content'),
      });
      expect(result).toEqual({
        success: true,
        channel: 'email',
        recipientCount: 2,
      });
    });

    it('should format HTML email body', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Line 1\nLine 2\nLine 3',
        recipientEmails: ['test@test.com'],
      };

      await service.sendEmailNotification(message);

      const mailOptions = mockEmailTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('Line 1<br>Line 2<br>Line 3');
      expect(mailOptions.html).toContain('Star Citizen Fleet Manager');
      expect(mailOptions.html).toContain('automated notification');
    });

    it('should handle single email recipient', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientEmails: ['single@test.com'],
      };

      const result = await service.sendEmailNotification(message);

      expect(result.recipientCount).toBe(1);
    });

    it('should fail when email transporter not configured', async () => {
      service = new NotificationService(); // No email config

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientEmails: ['test@test.com'],
      };

      const result = await service.sendEmailNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email transporter not configured');
    });

    it('should fail when no recipients specified', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientEmails: [],
      };

      const result = await service.sendEmailNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No email recipients specified');
    });

    it('should fail when recipientEmails is undefined', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const result = await service.sendEmailNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No email recipients specified');
    });

    it('should handle email send failure', async () => {
      mockEmailTransporter.sendMail = jest.fn().mockRejectedValue(new Error('SMTP error'));

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientEmails: ['test@test.com'],
      };

      const result = await service.sendEmailNotification(message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP error');
    });
  });

  describe('sendMultiChannelNotification', () => {
    beforeEach(() => {
      service = new NotificationService(mockDiscordClient, emailConfig, 'channel-123');
    });

    it('should send to Discord only', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test message',
      };

      const results = await service.sendMultiChannelNotification(message, ['discord']);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('discord');
      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockEmailTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should send to Email only', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test message',
        recipientEmails: ['test@test.com'],
      };

      const results = await service.sendMultiChannelNotification(message, ['email']);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('email');
      expect(mockEmailTransporter.sendMail).toHaveBeenCalled();
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should send to both Discord and Email', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test message',
        recipientEmails: ['test@test.com'],
      };

      const results = await service.sendMultiChannelNotification(message, ['discord', 'email']);

      expect(results).toHaveLength(2);
      expect(results[0].channel).toBe('discord');
      expect(results[1].channel).toBe('email');
      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockEmailTransporter.sendMail).toHaveBeenCalled();
    });

    it('should pass custom channelId to Discord', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      await service.sendMultiChannelNotification(message, ['discord'], 'custom-channel');

      expect(mockDiscordClient.channels.fetch).toHaveBeenCalledWith('custom-channel');
    });

    it('should handle empty channels array', async () => {
      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
      };

      const results = await service.sendMultiChannelNotification(message, []);

      expect(results).toHaveLength(0);
    });

    it('should handle mixed success/failure results', async () => {
      mockChannel.send = jest.fn().mockResolvedValue({});
      mockEmailTransporter.sendMail = jest.fn().mockRejectedValue(new Error('Email failed'));

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientEmails: ['test@test.com'],
      };

      const results = await service.sendMultiChannelNotification(message, ['discord', 'email']);

      expect(results[0].success).toBe(true); // Discord
      expect(results[1].success).toBe(false); // Email
    });
  });

  describe('createEventReminderEmbed', () => {
    beforeEach(() => {
      service = new NotificationService();
    });

    it('should create event reminder embed with all fields', () => {
      const eventDate = new Date('2025-10-20T14:00:00Z');

      const embed = service.createEventReminderEmbed(
        'Fleet Training Mission',
        eventDate,
        'Stanton System - Crusader',
        '2 hours',
        'Bring your combat ships'
      );

      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.title).toContain('Fleet Training Mission');
      expect(embed.data.color).toBe(0xffaa00);
      expect(embed.data.fields).toHaveLength(4); // Date, Location, Time Until, Additional Info
    });

    it('should create embed without additional info', () => {
      const eventDate = new Date('2025-10-20T14:00:00Z');

      const embed = service.createEventReminderEmbed(
        'Quick Mission',
        eventDate,
        'Microtech',
        '30 minutes'
      );

      expect(embed.data.fields).toHaveLength(3); // No Additional Info field
    });

    it('should include timestamp and footer', () => {
      const eventDate = new Date('2025-10-20T14:00:00Z');

      const embed = service.createEventReminderEmbed('Mission', eventDate, 'Location', '1 hour');

      expect(embed.data.timestamp).toBeDefined();
      expect(embed.data.footer?.text).toContain('prepared and ready');
    });
  });

  describe('createAttendanceConfirmationEmbed', () => {
    beforeEach(() => {
      service = new NotificationService();
    });

    it('should create attendance confirmation embed', () => {
      const eventDate = new Date('2025-10-20T14:00:00Z');

      const embed = service.createAttendanceConfirmationEmbed('Past Event', eventDate, 25);

      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.title).toContain('Attendance Confirmation');
      expect(embed.data.title).toContain('Past Event');
      expect(embed.data.color).toBe(0x00ff00);
    });

    it('should include attendee count', () => {
      const eventDate = new Date('2025-10-20T14:00:00Z');

      const embed = service.createAttendanceConfirmationEmbed('Event', eventDate, 42);

      const attendeeField = embed.data.fields?.find(f => f.name.includes('Expected Attendees'));
      expect(attendeeField?.value).toBe('42');
    });

    it('should include action instructions', () => {
      const eventDate = new Date('2025-10-20T14:00:00Z');

      const embed = service.createAttendanceConfirmationEmbed('Event', eventDate, 10);

      const actionField = embed.data.fields?.find(f => f.name.includes('Action Required'));
      expect(actionField?.value).toContain('/attendance confirm');
      expect(actionField?.value).toContain('/attendance noshow');
    });
  });

  describe('createConflictWarningEmbed', () => {
    beforeEach(() => {
      service = new NotificationService();
    });

    it('should create conflict warning embed with single conflict', () => {
      const conflicts = [
        {
          eventTitle: 'Existing Operation',
          eventDate: new Date('2025-10-20T14:00:00Z'),
        },
      ];

      const embed = service.createConflictWarningEmbed('New Mission', conflicts);

      expect(embed).toBeInstanceOf(EmbedBuilder);
      expect(embed.data.title).toContain('Conflict Detected');
      expect(embed.data.color).toBe(0xff0000);
      expect(embed.data.fields).toHaveLength(2); // 1 conflict + 1 suggestion
    });

    it('should create embed with multiple conflicts', () => {
      const conflicts = [
        { eventTitle: 'Mission 1', eventDate: new Date('2025-10-20T14:00:00Z') },
        { eventTitle: 'Mission 2', eventDate: new Date('2025-10-20T15:00:00Z') },
        { eventTitle: 'Mission 3', eventDate: new Date('2025-10-20T16:00:00Z') },
      ];

      const embed = service.createConflictWarningEmbed('New Event', conflicts);

      expect(embed.data.fields).toHaveLength(4); // 3 conflicts + 1 suggestion
    });

    it('should include conflict details in fields', () => {
      const conflicts = [
        {
          eventTitle: 'Conflicting Event',
          eventDate: new Date('2025-10-20T14:00:00Z'),
        },
      ];

      const embed = service.createConflictWarningEmbed('Test Event', conflicts);

      const conflictField = embed.data.fields?.[0];
      expect(conflictField?.name).toContain('Conflicting Event');
      expect(conflictField?.value).toContain('📅');
    });

    it('should include suggestion field', () => {
      const conflicts = [{ eventTitle: 'Event', eventDate: new Date() }];

      const embed = service.createConflictWarningEmbed('Test', conflicts);

      const suggestionField = embed.data.fields?.find(f => f.name.includes('Suggestion'));
      expect(suggestionField).toBeDefined();
      expect(suggestionField?.value).toContain('rescheduling');
    });

    it('should handle empty conflicts array', () => {
      const embed = service.createConflictWarningEmbed('Test Event', []);

      expect(embed.data.fields).toHaveLength(1); // Only suggestion field
    });
  });

  describe('testConfiguration', () => {
    it('should return true for both when fully configured', async () => {
      service = new NotificationService(mockDiscordClient, emailConfig);

      const result = await service.testConfiguration();

      expect(result.discord).toBe(true);
      expect(result.email).toBe(true);
      expect(mockEmailTransporter.verify).toHaveBeenCalled();
    });

    it('should return true for Discord only', async () => {
      service = new NotificationService(mockDiscordClient);

      const result = await service.testConfiguration();

      expect(result.discord).toBe(true);
      expect(result.email).toBe(false);
    });

    it('should return true for Email only', async () => {
      service = new NotificationService(undefined, emailConfig);

      const result = await service.testConfiguration();

      expect(result.discord).toBe(false);
      expect(result.email).toBe(true);
    });

    it('should return false when Discord client not ready', async () => {
      const notReadyClient = {
        ...mockDiscordClient,
        isReady: jest.fn().mockReturnValue(false),
      } as any;
      service = new NotificationService(notReadyClient);

      const result = await service.testConfiguration();

      expect(result.discord).toBe(false);
    });

    it('should return false when email verification fails', async () => {
      mockEmailTransporter.verify = jest.fn().mockRejectedValue(new Error('Verification failed'));
      service = new NotificationService(undefined, emailConfig);

      const result = await service.testConfiguration();

      expect(result.email).toBe(false);
    });

    it('should return false for both when not configured', async () => {
      service = new NotificationService();

      const result = await service.testConfiguration();

      expect(result.discord).toBe(false);
      expect(result.email).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      service = new NotificationService(mockDiscordClient, emailConfig, 'channel-123');
    });

    it('should send complete notification with embed to both channels', async () => {
      const embed = new EmbedBuilder()
        .setTitle('Important Update')
        .setDescription('Fleet operation scheduled');

      const message: NotificationMessage = {
        subject: 'Fleet Update',
        body: 'Important information about upcoming operations',
        embed,
        recipientIds: ['user-1', 'user-2'],
        recipientEmails: ['fleet1@test.com', 'fleet2@test.com'],
      };

      const results = await service.sendMultiChannelNotification(message, ['discord', 'email']);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith({ embeds: [embed] });
      expect(mockEmailTransporter.sendMail).toHaveBeenCalled();
    });

    it('should handle large recipient lists', async () => {
      const recipientIds = Array.from({ length: 50 }, (_, i) => `user-${i}`);
      const recipientEmails = Array.from({ length: 50 }, (_, i) => `user${i}@test.com`);

      const message: NotificationMessage = {
        subject: 'Mass Notification',
        body: 'Important announcement',
        recipientIds,
        recipientEmails,
      };

      const results = await service.sendMultiChannelNotification(message, ['discord', 'email']);

      expect(mockDiscordClient.users.fetch).toHaveBeenCalledTimes(50);
      expect(results[0].recipientCount).toBe(50);
      expect(results[1].recipientCount).toBe(50);
    });

    it('should continue processing even if one channel fails', async () => {
      mockChannel.send = jest.fn().mockRejectedValue(new Error('Discord error'));
      mockEmailTransporter.sendMail = jest.fn().mockResolvedValue({ messageId: 'success' });

      const message: NotificationMessage = {
        subject: 'Test',
        body: 'Test',
        recipientEmails: ['test@test.com'],
      };

      const results = await service.sendMultiChannelNotification(message, ['discord', 'email']);

      expect(results[0].success).toBe(false); // Discord failed
      expect(results[1].success).toBe(true); // Email succeeded
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
