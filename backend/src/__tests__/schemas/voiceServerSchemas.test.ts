import { voiceServerConfigSchema } from '../../schemas/voiceServerSchemas';

describe('voiceServerConfigSchema', () => {
  const basePayload = {
    enabled: true,
    serverType: 'mumble',
    host: 'voice.example.com',
    port: 64738,
  };

  it('accepts federation whitelist entries with UUID target IDs', () => {
    const result = voiceServerConfigSchema.validate({
      ...basePayload,
      sharing: {
        enabled: true,
        whitelist: [
          {
            type: 'federation',
            targetId: '550e8400-e29b-41d4-a716-446655440000',
            targetName: 'Test Federation',
          },
        ],
      },
    });

    expect(result.error).toBeUndefined();
  });

  it('accepts organization whitelist entries with non-UUID organization IDs', () => {
    const result = voiceServerConfigSchema.validate({
      ...basePayload,
      sharing: {
        enabled: true,
        whitelist: [
          {
            type: 'organization',
            targetId: 'industrial-star-alliance-corp',
            targetName: 'Industrial Star Alliance Corp',
          },
        ],
      },
    });

    expect(result.error).toBeUndefined();
  });

  it('rejects federation whitelist entries with non-UUID target IDs', () => {
    const result = voiceServerConfigSchema.validate({
      ...basePayload,
      sharing: {
        enabled: true,
        whitelist: [
          {
            type: 'federation',
            targetId: 'industrial-star-alliance-corp',
            targetName: 'Industrial Star Alliance Corp',
          },
        ],
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('targetId');
  });

  it('accepts starcomms as a supported voice server type', () => {
    const result = voiceServerConfigSchema.validate({
      ...basePayload,
      serverType: 'starcomms',
      port: 443,
      connectUrl: 'https://starcomms.example.com',
    });

    expect(result.error).toBeUndefined();
  });

  it('accepts starcomms central mode', () => {
    const result = voiceServerConfigSchema.validate({
      ...basePayload,
      serverType: 'starcomms',
      starCommsVoiceMode: 'central',
      port: 443,
    });

    expect(result.error).toBeUndefined();
  });

  it('accepts starcomms private mode', () => {
    const result = voiceServerConfigSchema.validate({
      ...basePayload,
      serverType: 'starcomms',
      starCommsVoiceMode: 'private',
      port: 443,
    });

    expect(result.error).toBeUndefined();
  });
});
