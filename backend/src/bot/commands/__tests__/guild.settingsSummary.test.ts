/**
 * Regression tests for the `/guild status` feature-status summary.
 *
 * Bug: the Voice line reported "❌ not configured" whenever the legacy singular
 * `hubChannelId` was empty, even though the web dashboard persists hub channels to the
 * `hubChannelIds` array (multi-hub). The status report must mirror voiceAutoCreate.ts:
 * configured when `autoCreateChannels` is on AND at least one hub exists in the union of
 * `hubChannelId` and `hubChannelIds`.
 */

import type {
  DiscordGuildSettings,
  VoiceChannelSettings,
} from '../../../models/DiscordGuildSettings';
import { buildSettingsSummary } from '../guild';

function settingsWithVoice(voice: Partial<VoiceChannelSettings>): DiscordGuildSettings {
  return { voiceChannelSettings: voice } as unknown as DiscordGuildSettings;
}

function voiceLine(lines: string[]): string {
  return lines.find(line => line.includes('**Voice**')) ?? '';
}

describe('buildSettingsSummary — Voice', () => {
  it('reports configured when the hub is only in the hubChannelIds array (web multi-hub path)', () => {
    const line = voiceLine(
      buildSettingsSummary(settingsWithVoice({ autoCreateChannels: true, hubChannelIds: ['111'] }))
    );
    expect(line).toContain('✅');
    expect(line).toContain('<#111>');
    expect(line).not.toContain('not configured');
  });

  it('still reports configured via the legacy singular hubChannelId', () => {
    const line = voiceLine(
      buildSettingsSummary(settingsWithVoice({ autoCreateChannels: true, hubChannelId: '222' }))
    );
    expect(line).toContain('✅');
    expect(line).toContain('<#222>');
  });

  it('appends "(+N more)" when multiple hubs are configured', () => {
    const line = voiceLine(
      buildSettingsSummary(
        settingsWithVoice({ autoCreateChannels: true, hubChannelIds: ['111', '222', '333'] })
      )
    );
    expect(line).toContain('✅');
    expect(line).toContain('<#111>');
    expect(line).toContain('(+2 more)');
  });

  it('dedupes a singular hub that also appears in the array', () => {
    const line = voiceLine(
      buildSettingsSummary(
        settingsWithVoice({ autoCreateChannels: true, hubChannelId: '111', hubChannelIds: ['111'] })
      )
    );
    expect(line).toContain('✅');
    expect(line).not.toContain('more');
  });

  it('reports not configured when auto-create is off even with a hub', () => {
    const line = voiceLine(
      buildSettingsSummary(settingsWithVoice({ autoCreateChannels: false, hubChannelIds: ['111'] }))
    );
    expect(line).toContain('❌');
    expect(line).toContain('not configured');
  });

  it('reports not configured when auto-create is on but there is no hub', () => {
    const line = voiceLine(
      buildSettingsSummary(settingsWithVoice({ autoCreateChannels: true, hubChannelIds: [] }))
    );
    expect(line).toContain('❌');
    expect(line).toContain('not configured');
  });

  it('ignores empty-string hub ids', () => {
    const line = voiceLine(
      buildSettingsSummary(
        settingsWithVoice({ autoCreateChannels: true, hubChannelId: '', hubChannelIds: [''] })
      )
    );
    expect(line).toContain('❌');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
