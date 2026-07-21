import {
  buildDmNotificationStatusEmbed,
  buildLfgPingStatusEmbed,
  buildMyNotificationPreferencesEmbed,
} from '../notifyEmbeds';

const formatBool = (value?: boolean): string => {
  if (value === undefined || value === null) {
    return '⬜ Not set';
  }
  return value ? '✅ Enabled' : '❌ Disabled';
};

describe('notifyEmbeds', () => {
  it('builds DM notification status embed with enabled branch and expected fields', () => {
    const embed = buildDmNotificationStatusEmbed(
      {
        enabled: true,
        ticketCreated: true,
        ticketAssigned: false,
        eventReminder: true,
      },
      formatBool
    );

    expect(embed.data.title).toBe('🔔 DM Notification Settings');
    expect(embed.data.color).toBe(0x00c853);
    expect(embed.data.description).toContain('enabled');

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(11);
    expect(fields[0]?.name).toBe('🎫 Ticket Created');
    expect(fields[0]?.value).toBe('✅ Enabled');
    expect(fields[1]?.name).toBe('🎫 Ticket Assigned');
    expect(fields[1]?.value).toBe('❌ Disabled');
    expect(fields[8]?.name).toBe('📅 Event Reminder');
    expect(fields[8]?.value).toBe('✅ Enabled');
    expect(embed.data.timestamp).toBeDefined();
  });

  it('builds LFG ping status embed with disabled defaults', () => {
    const embed = buildLfgPingStatusEmbed(undefined);

    expect(embed.data.title).toBe('🎮 Smart LFG Ping Settings');
    expect(embed.data.color).toBe(0x9e9e9e);

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(4);
    expect(fields[0]).toMatchObject({ name: 'Cooldown', value: '8h', inline: true });
    expect(fields[1]).toMatchObject({ name: 'Max Pings/Post', value: '5', inline: true });
    expect(fields[2]).toMatchObject({ name: 'Opt-In Role', value: 'None (all members)' });
    expect(fields[3]).toMatchObject({
      name: 'Activity Filter',
      value: 'All activities',
      inline: false,
    });
    expect(embed.data.timestamp).toBeDefined();
  });

  it('builds personal preference embed with footer and timezone fallback', () => {
    const embed = buildMyNotificationPreferencesEmbed(
      {
        dmEnabled: false,
        lfgPingOptIn: true,
        eventReminderOptIn: false,
        ticketDmOptIn: true,
        recruitmentDmOptIn: false,
        moderationAlertOptIn: true,
        botResponseViaDm: false,
      },
      formatBool
    );

    expect(embed.data.title).toBe('Your DM Notification Preferences');
    expect(embed.data.color).toBe(0x9e9e9e);
    expect(embed.data.description).toContain('disabled');

    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(8);
    expect(fields[0]?.name).toBe('All DMs');
    expect(fields[0]?.value).toBe('❌ Disabled');
    expect(fields[1]?.name).toBe('LFG Pings');
    expect(fields[1]?.value).toBe('✅ Enabled');
    expect(fields[7]).toMatchObject({ name: 'Timezone', value: 'Not set' });

    expect(embed.data.footer?.text).toBe(
      'These are your personal preferences — they override server defaults'
    );
    expect(embed.data.timestamp).toBeDefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
