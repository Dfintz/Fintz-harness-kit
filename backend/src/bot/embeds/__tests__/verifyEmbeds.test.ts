import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildDiscordAccountNotLinkedEmbed,
  buildNoRsiLinkEmbed,
  buildRsiLinkInitiatedEmbed,
  buildRsiLinkStatusEmbed,
  buildRsiLinkStatusNotLinkedEmbed,
  buildRsiUnlinkedEmbed,
  buildVerificationCompleteEmbed,
  buildVerificationPendingEmbed,
  type RsiLinkStatusInput,
} from '../verifyEmbeds';

const fieldNames = (embed: { data: { fields?: { name: string }[] } }): string[] =>
  (embed.data.fields ?? []).map(field => field.name);

const fieldValue = (
  embed: { data: { fields?: { name: string; value: string }[] } },
  name: string
): string | undefined => (embed.data.fields ?? []).find(field => field.name === name)?.value;

describe('buildVerificationCompleteEmbed', () => {
  it('uses the success theme and interpolates the RSI handle', () => {
    const embed = buildVerificationCompleteEmbed('CitizenJane');

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toContain('RSI Verification Complete');
    expect(embed.data.description).toContain('CitizenJane');
    expect(embed.data.description).toContain('has been verified');
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('buildVerificationPendingEmbed', () => {
  it('uses the warning theme and shows the provided error', () => {
    const embed = buildVerificationPendingEmbed('Custom failure detail.');

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('Verification Not Yet Complete');
    expect(embed.data.description).toBe('Custom failure detail.');
  });

  it('falls back to a default message when no error is provided', () => {
    const embed = buildVerificationPendingEmbed();

    expect(embed.data.description).toContain('Verification link not found');
  });
});

describe('buildNoRsiLinkEmbed', () => {
  it('uses the closed theme and prompts the user to link', () => {
    const embed = buildNoRsiLinkEmbed();

    expect(embed.data.color).toBe(EmbedColors.CLOSED);
    expect(embed.data.title).toContain('No RSI Link Found');
    expect(embed.data.description).toContain('Link RSI');
  });
});

describe('buildRsiLinkStatusEmbed', () => {
  it('uses the success theme and a verified marker when the link is verified', () => {
    const embed = buildRsiLinkStatusEmbed({
      rsiHandle: 'CitizenJane',
      verifiedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toContain('RSI Link Status');
    expect(fieldValue(embed, 'RSI Handle')).toBe('CitizenJane');
    expect(fieldValue(embed, 'Verified')).toContain('Yes');
    expect(fieldValue(embed, 'Verified')).toContain('\u2705');
    // Verified links omit the verification-instructions field.
    expect(fieldNames(embed)).toEqual(['RSI Handle', 'Verified', 'Sync Status']);
  });

  it('uses the warning theme and a pending marker when the link is unverified', () => {
    const embed = buildRsiLinkStatusEmbed({ rsiHandle: 'CitizenJane' });

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(fieldValue(embed, 'Verified')).toContain('No');
    expect(fieldValue(embed, 'Verified')).toContain('\u23f3');
  });

  it('maps the sync status to its indicator emoji and defaults to pending', () => {
    expect(
      fieldValue(buildRsiLinkStatusEmbed({ rsiHandle: 'X', syncStatus: 'synced' }), 'Sync Status')
    ).toBe('\u{1F7E2} synced');
    expect(
      fieldValue(buildRsiLinkStatusEmbed({ rsiHandle: 'X', syncStatus: 'failed' }), 'Sync Status')
    ).toBe('\u{1F534} failed');
    expect(fieldValue(buildRsiLinkStatusEmbed({ rsiHandle: 'X' }), 'Sync Status')).toBe(
      '\u{1F7E1} pending'
    );
  });

  it('appends the optional fields in order and renders a relative last-synced timestamp', () => {
    const link: RsiLinkStatusInput = {
      rsiHandle: 'CitizenJane',
      lastKnownRank: 'Lieutenant',
      isAffiliate: true,
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      verificationUrl: 'https://example.test/v',
    };

    const embed = buildRsiLinkStatusEmbed(link);

    expect(fieldNames(embed)).toEqual([
      'RSI Handle',
      'Verified',
      'Sync Status',
      'RSI Rank',
      'Affiliate',
      'Last Synced',
      '\u{1F4DD} Verification Link',
    ]);
    expect(fieldValue(embed, 'RSI Rank')).toBe('Lieutenant');
    expect(fieldValue(embed, 'Last Synced')).toMatch(/^<t:\d+:R>$/);
  });

  it('prefers the verification link over the verification code when both are present', () => {
    const embed = buildRsiLinkStatusEmbed({
      rsiHandle: 'CitizenJane',
      verificationUrl: 'https://example.test/v',
      verificationCode: 'ABC123',
    });

    expect(fieldNames(embed)).toContain('\u{1F4DD} Verification Link');
    expect(fieldNames(embed)).not.toContain('\u{1F4DD} Verification Code');
  });

  it('falls back to the verification code when no link is available', () => {
    const embed = buildRsiLinkStatusEmbed({ rsiHandle: 'CitizenJane', verificationCode: 'ABC123' });

    expect(fieldValue(embed, '\u{1F4DD} Verification Code')).toContain('ABC123');
  });
});

describe('buildRsiLinkStatusNotLinkedEmbed', () => {
  it('uses the closed theme and explains how to link', () => {
    const embed = buildRsiLinkStatusNotLinkedEmbed();

    expect(embed.data.color).toBe(EmbedColors.CLOSED);
    expect(embed.data.title).toContain('RSI Link Status');
    expect(embed.data.description).toContain('not linked');
    expect(fieldValue(embed, 'How to Link')).toContain('Link RSI');
  });
});

describe('buildRsiUnlinkedEmbed', () => {
  it('uses the warning theme and notes the sync side effect', () => {
    const embed = buildRsiUnlinkedEmbed();

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('RSI Handle Unlinked');
    expect(fieldValue(embed, 'Note')).toContain('removed on the next sync');
  });
});

describe('buildDiscordAccountNotLinkedEmbed', () => {
  it('uses the warning theme and embeds the prompt message with next steps', () => {
    const embed = buildDiscordAccountNotLinkedEmbed('Link your account first.');

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('Discord Account Not Linked');
    expect(embed.data.description).toContain('Link your account first.');
    expect(embed.data.description).toContain('Sign In with Discord');
    expect(embed.data.description).toContain('1\uFE0F\u20E3');
  });
});

describe('buildRsiLinkInitiatedEmbed', () => {
  it('uses the success theme and renders link-based instructions when a link is provided', () => {
    const embed = buildRsiLinkInitiatedEmbed(
      'CitizenJane',
      'https://example.test/profile',
      'https://example.test/verify'
    );

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toContain('RSI Link Initiated');
    expect(embed.data.description).toContain('CitizenJane');
    expect(embed.data.description).toContain('Your verification link:');
    expect(embed.data.description).toContain('https://example.test/verify');
    expect(embed.data.description).toContain('[RSI Profile](https://example.test/profile)');
  });

  it('renders code-based instructions when only a code is provided', () => {
    const embed = buildRsiLinkInitiatedEmbed(
      'CitizenJane',
      'https://example.test/profile',
      undefined,
      'BIO-CODE-123'
    );

    expect(embed.data.description).toContain('Your verification code:');
    expect(embed.data.description).toContain('BIO-CODE-123');
  });

  it('falls back to the My Verification prompt when neither link nor code is available', () => {
    const embed = buildRsiLinkInitiatedEmbed('CitizenJane', 'https://example.test/profile');

    expect(embed.data.description).toContain('My Verification');
    expect(embed.data.description).not.toContain('Your verification link:');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
