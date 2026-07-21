import { discordSettingsSchemas } from '../../schemas/discordSchemas';

/**
 * Coverage for the schemas added in PR9 ("GuildSettingsDTO Joi gap audit"):
 * timezone, quickResponseCreate, quickResponseCategoryCreate,
 * voiceTemplateCreate, userPreferences.
 *
 * These five mutation endpoints previously bypassed Joi validation in
 * `discordSettingsController.ts` and relied on inline `if` checks.
 */
describe('discordSettingsSchemas — PR9 gap audit', () => {
  describe('timezone', () => {
    it('accepts a valid IANA identifier', () => {
      const result = discordSettingsSchemas.timezone.validate({ timezone: 'America/New_York' });
      expect(result.error).toBeUndefined();
    });

    it('accepts UTC and GMT', () => {
      expect(discordSettingsSchemas.timezone.validate({ timezone: 'UTC' }).error).toBeUndefined();
      expect(discordSettingsSchemas.timezone.validate({ timezone: 'GMT' }).error).toBeUndefined();
    });

    it('accepts an empty string (clears the field)', () => {
      const result = discordSettingsSchemas.timezone.validate({ timezone: '' });
      expect(result.error).toBeUndefined();
    });

    it('rejects garbage strings', () => {
      const result = discordSettingsSchemas.timezone.validate({ timezone: 'not-a-tz' });
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('valid IANA identifier');
    });

    it('rejects strings exceeding 64 chars', () => {
      const result = discordSettingsSchemas.timezone.validate({
        timezone: 'America/Argentina/Buenos_Aires_'.repeat(5),
      });
      expect(result.error).toBeDefined();
    });

    it('requires the timezone field', () => {
      const result = discordSettingsSchemas.timezone.validate({});
      expect(result.error).toBeDefined();
    });
  });

  describe('quickResponseCreate', () => {
    it('accepts a valid payload with category', () => {
      const result = discordSettingsSchemas.quickResponseCreate.validate({
        name: 'Greeting',
        content: 'Hello and welcome!',
        categoryId: 'cat-1',
      });
      expect(result.error).toBeUndefined();
    });

    it('accepts a valid payload without category', () => {
      const result = discordSettingsSchemas.quickResponseCreate.validate({
        name: 'Greeting',
        content: 'Hello',
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects missing name', () => {
      const result = discordSettingsSchemas.quickResponseCreate.validate({ content: 'x' });
      expect(result.error).toBeDefined();
    });

    it('rejects missing content', () => {
      const result = discordSettingsSchemas.quickResponseCreate.validate({ name: 'x' });
      expect(result.error).toBeDefined();
    });

    it('rejects content exceeding 2000 chars', () => {
      const result = discordSettingsSchemas.quickResponseCreate.validate({
        name: 'x',
        content: 'a'.repeat(2001),
      });
      expect(result.error).toBeDefined();
    });

    it('rejects name exceeding 100 chars', () => {
      const result = discordSettingsSchemas.quickResponseCreate.validate({
        name: 'a'.repeat(101),
        content: 'ok',
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('quickResponseCategoryCreate', () => {
    it('accepts a valid payload', () => {
      const result = discordSettingsSchemas.quickResponseCategoryCreate.validate({
        name: 'General',
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects missing name', () => {
      const result = discordSettingsSchemas.quickResponseCategoryCreate.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects empty name', () => {
      const result = discordSettingsSchemas.quickResponseCategoryCreate.validate({ name: '' });
      expect(result.error).toBeDefined();
    });

    it('rejects name exceeding 100 chars', () => {
      const result = discordSettingsSchemas.quickResponseCategoryCreate.validate({
        name: 'a'.repeat(101),
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('voiceTemplateCreate', () => {
    it('accepts a minimal valid payload', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({ name: 'Squad' });
      expect(result.error).toBeUndefined();
    });

    it('accepts a full valid payload', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({
        name: 'Squad',
        description: 'Small group voice',
        bitrate: 64000,
        userLimit: 10,
        nameTemplate: "{user}'s Channel",
        autoDelete: true,
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects missing name', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({ bitrate: 64000 });
      expect(result.error).toBeDefined();
    });

    it('rejects bitrate below Discord minimum (8000)', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({
        name: 'Squad',
        bitrate: 7000,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects bitrate above Discord maximum (384000)', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({
        name: 'Squad',
        bitrate: 400000,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects userLimit above 99', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({
        name: 'Squad',
        userLimit: 100,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects negative userLimit', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({
        name: 'Squad',
        userLimit: -1,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects description exceeding 500 chars', () => {
      const result = discordSettingsSchemas.voiceTemplateCreate.validate({
        name: 'Squad',
        description: 'a'.repeat(501),
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('userPreferences', () => {
    it('accepts a single boolean field', () => {
      const result = discordSettingsSchemas.userPreferences.validate({ dmEnabled: true });
      expect(result.error).toBeUndefined();
    });

    it('accepts all boolean fields together', () => {
      const result = discordSettingsSchemas.userPreferences.validate({
        dmEnabled: true,
        lfgPingOptIn: false,
        eventReminderOptIn: true,
        ticketDmOptIn: false,
        recruitmentDmOptIn: true,
        moderationAlertOptIn: false,
      });
      expect(result.error).toBeUndefined();
    });

    it('accepts a valid IANA timezone', () => {
      const result = discordSettingsSchemas.userPreferences.validate({
        timezone: 'Europe/London',
      });
      expect(result.error).toBeUndefined();
    });

    it('accepts empty timezone (clears the field)', () => {
      const result = discordSettingsSchemas.userPreferences.validate({ timezone: '' });
      expect(result.error).toBeUndefined();
    });

    it('rejects a malformed timezone', () => {
      const result = discordSettingsSchemas.userPreferences.validate({ timezone: 'NotAZone' });
      expect(result.error).toBeDefined();
    });

    it('rejects an empty body', () => {
      const result = discordSettingsSchemas.userPreferences.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects unknown fields', () => {
      const result = discordSettingsSchemas.userPreferences.validate({
        dmEnabled: true,
        evilField: 'xss',
      });
      expect(result.error).toBeDefined();
    });

    it('rejects non-boolean values for boolean fields', () => {
      const result = discordSettingsSchemas.userPreferences.validate({ dmEnabled: 'yes' });
      expect(result.error).toBeDefined();
    });
  });
});

/**
 * Coverage for the schemas added in PR9 deferred item #1
 * (5 missing PATCH routes for stat/dm-notification/smart-lfg-ping/giveaway/advanced-event settings).
 */
describe('discordSettingsSchemas — deferred item #1 (5 PATCH gaps)', () => {
  describe('statSettings', () => {
    it('accepts a minimal payload', () => {
      const result = discordSettingsSchemas.statSettings.validate({ enabled: true });
      expect(result.error).toBeUndefined();
    });

    it('accepts a full payload', () => {
      const result = discordSettingsSchemas.statSettings.validate({
        enabled: true,
        trackMessages: true,
        trackVoice: false,
        trackInvites: true,
        excludedChannelIds: ['123456789012345678'],
        excludedRoleIds: ['987654321098765432'],
        retentionDays: 90,
        statRoleEvalIntervalHours: 6,
        counterUpdateIntervalMinutes: 15,
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects empty objects (must update at least one field)', () => {
      const result = discordSettingsSchemas.statSettings.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects retentionDays out of range', () => {
      const result = discordSettingsSchemas.statSettings.validate({ retentionDays: 0 });
      expect(result.error).toBeDefined();
    });

    it('rejects malformed channel IDs', () => {
      const result = discordSettingsSchemas.statSettings.validate({
        excludedChannelIds: ['not-a-snowflake'],
      });
      expect(result.error).toBeDefined();
    });

    it('rejects unknown fields', () => {
      const result = discordSettingsSchemas.statSettings.validate({
        enabled: true,
        evilField: 'xss',
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('dmNotificationSettings', () => {
    it('accepts a minimal payload', () => {
      const result = discordSettingsSchemas.dmNotificationSettings.validate({ enabled: true });
      expect(result.error).toBeUndefined();
    });

    it('accepts a full payload', () => {
      const result = discordSettingsSchemas.dmNotificationSettings.validate({
        enabled: true,
        ticketCreated: true,
        ticketAssigned: false,
        ticketReplied: true,
        ticketClosed: false,
        ticketEscalated: true,
        recruitmentReceived: true,
        recruitmentAccepted: false,
        recruitmentDenied: false,
        eventReminder: true,
        eventCancelled: true,
        lfgPlayerJoined: false,
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects empty objects', () => {
      const result = discordSettingsSchemas.dmNotificationSettings.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects non-boolean values', () => {
      const result = discordSettingsSchemas.dmNotificationSettings.validate({
        enabled: 'yes',
      });
      expect(result.error).toBeDefined();
    });

    it('rejects unknown fields', () => {
      const result = discordSettingsSchemas.dmNotificationSettings.validate({
        enabled: true,
        evilField: 'xss',
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('smartLfgPingSettings', () => {
    it('accepts a minimal payload', () => {
      const result = discordSettingsSchemas.smartLfgPingSettings.validate({ enabled: true });
      expect(result.error).toBeUndefined();
    });

    it('accepts a full payload', () => {
      const result = discordSettingsSchemas.smartLfgPingSettings.validate({
        enabled: true,
        cooldownHours: 24,
        maxPingsPerPost: 5,
        activityFilter: ['mining', 'bounty', 'trading'],
        optInRoleId: '123456789012345678',
      });
      expect(result.error).toBeUndefined();
    });

    it('accepts an empty optInRoleId (clears the field)', () => {
      const result = discordSettingsSchemas.smartLfgPingSettings.validate({
        enabled: true,
        optInRoleId: '',
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects empty objects', () => {
      const result = discordSettingsSchemas.smartLfgPingSettings.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects cooldownHours out of range', () => {
      const result = discordSettingsSchemas.smartLfgPingSettings.validate({
        cooldownHours: 200,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects malformed optInRoleId', () => {
      const result = discordSettingsSchemas.smartLfgPingSettings.validate({
        optInRoleId: 'not-a-snowflake',
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('giveawaySettings', () => {
    it('accepts a minimal payload', () => {
      const result = discordSettingsSchemas.giveawaySettings.validate({ enabled: true });
      expect(result.error).toBeUndefined();
    });

    it('accepts a full payload', () => {
      const result = discordSettingsSchemas.giveawaySettings.validate({
        enabled: true,
        maxActivegiveaways: 10,
        defaultDurationMinutes: 1440,
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects empty objects', () => {
      const result = discordSettingsSchemas.giveawaySettings.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects defaultDurationMinutes below 1', () => {
      const result = discordSettingsSchemas.giveawaySettings.validate({
        defaultDurationMinutes: 0,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects defaultDurationMinutes above 43200', () => {
      const result = discordSettingsSchemas.giveawaySettings.validate({
        defaultDurationMinutes: 43201,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects unknown fields', () => {
      const result = discordSettingsSchemas.giveawaySettings.validate({
        enabled: true,
        evilField: 'xss',
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('advancedEventSettings', () => {
    it('accepts a minimal payload', () => {
      const result = discordSettingsSchemas.advancedEventSettings.validate({ lockWhenFull: true });
      expect(result.error).toBeUndefined();
    });

    it('accepts a full payload', () => {
      const result = discordSettingsSchemas.advancedEventSettings.validate({
        lockWhenFull: true,
        benchEnabled: true,
        maxBenchSlots: 10,
        preventDuplicateRsvp: true,
        signupDeadlineHours: 2,
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects empty objects', () => {
      const result = discordSettingsSchemas.advancedEventSettings.validate({});
      expect(result.error).toBeDefined();
    });

    it('rejects maxBenchSlots above 1000', () => {
      const result = discordSettingsSchemas.advancedEventSettings.validate({
        maxBenchSlots: 1001,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects signupDeadlineHours above 720', () => {
      const result = discordSettingsSchemas.advancedEventSettings.validate({
        signupDeadlineHours: 721,
      });
      expect(result.error).toBeDefined();
    });

    it('rejects unknown fields', () => {
      const result = discordSettingsSchemas.advancedEventSettings.validate({
        lockWhenFull: true,
        evilField: 'xss',
      });
      expect(result.error).toBeDefined();
    });
  });
});

describe('discordSettingsSchemas — role sync mappings', () => {
  it('accepts a single Discord role ID per rank', () => {
    const result = discordSettingsSchemas.roleSyncSettings.validate({
      enabled: true,
      roleMappings: {
        Officer: '123456789012345678',
      },
    });

    expect(result.error).toBeUndefined();
  });

  it('accepts multiple Discord role IDs per rank', () => {
    const result = discordSettingsSchemas.roleSyncSettings.validate({
      enabled: true,
      roleMappings: {
        Officer: ['123456789012345678', '987654321098765432'],
      },
    });

    expect(result.error).toBeUndefined();
  });

  it('rejects invalid multi-role mappings', () => {
    const result = discordSettingsSchemas.roleSyncSettings.validate({
      enabled: true,
      roleMappings: {
        Officer: ['not-a-role-id'],
      },
    });

    expect(result.error).toBeDefined();
  });
});

describe('discordSettingsSchemas — access control payload split', () => {
  describe('adminManagement', () => {
    it('accepts userId payload', () => {
      const result = discordSettingsSchemas.adminManagement.validate({
        userId: '123456789012345678',
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects roleId-only payload', () => {
      const result = discordSettingsSchemas.adminManagement.validate({
        roleId: '123456789012345678',
      });
      expect(result.error).toBeDefined();
    });
  });

  describe('serverManagerManagement', () => {
    it('accepts roleId payload', () => {
      const result = discordSettingsSchemas.serverManagerManagement.validate({
        roleId: '123456789012345678',
      });
      expect(result.error).toBeUndefined();
    });

    it('rejects userId-only payload', () => {
      const result = discordSettingsSchemas.serverManagerManagement.validate({
        userId: '123456789012345678',
      });
      expect(result.error).toBeDefined();
    });
  });
});
