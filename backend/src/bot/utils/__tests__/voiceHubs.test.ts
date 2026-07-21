import type { VoiceChannelSettings } from '../../../models/DiscordGuildSettings';
import { formatVoiceHubs, getConfiguredVoiceHubs } from '../voiceHubs';

describe('getConfiguredVoiceHubs', () => {
  it('returns the array hubs when only hubChannelIds is set (web multi-hub path)', () => {
    expect(getConfiguredVoiceHubs({ hubChannelIds: ['111', '222'] })).toEqual(['111', '222']);
  });

  it('includes the legacy singular hubChannelId', () => {
    expect(getConfiguredVoiceHubs({ hubChannelId: '111' })).toEqual(['111']);
  });

  it('dedupes a singular hub that also appears in the array', () => {
    expect(getConfiguredVoiceHubs({ hubChannelId: '111', hubChannelIds: ['111', '222'] })).toEqual([
      '111',
      '222',
    ]);
  });

  it('filters out empty / missing ids', () => {
    expect(getConfiguredVoiceHubs({ hubChannelId: '', hubChannelIds: ['', '333'] })).toEqual([
      '333',
    ]);
  });

  it('returns an empty array for undefined settings', () => {
    expect(getConfiguredVoiceHubs(undefined)).toEqual([]);
  });
});

describe('formatVoiceHubs', () => {
  it('renders an array-only hub as a channel mention', () => {
    expect(formatVoiceHubs({ hubChannelIds: ['111'] })).toBe('<#111>');
  });

  it('joins multiple configured hubs', () => {
    expect(formatVoiceHubs({ hubChannelIds: ['111', '222'] })).toBe('<#111>, <#222>');
  });

  it('returns *not set* when no hub is configured', () => {
    const noHub: VoiceChannelSettings = { autoCreateChannels: true };
    expect(formatVoiceHubs(noHub)).toBe('*not set*');
    expect(formatVoiceHubs(undefined)).toBe('*not set*');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
