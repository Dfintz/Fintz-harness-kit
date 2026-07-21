import { buildAppUrl } from '../../utils/appUrls';
import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildWikiNoResultsEmbed,
  buildWikiPageEmbed,
  buildWikiSearchEmbed,
  type WikiPageInput,
  type WikiSearchResultInput,
} from '../wikiEmbeds';

function buildPage(overrides: Partial<WikiPageInput> = {}): WikiPageInput {
  return {
    title: 'Getting Started',
    slug: 'getting-started',
    content: 'Welcome to the **wiki**.',
    version: 3,
    isLocked: false,
    updatedAt: new Date('2026-06-12T12:34:56.000Z'),
    ...overrides,
  };
}

describe('buildWikiNoResultsEmbed', () => {
  it('uses the warning theme and echoes the query', () => {
    const embed = buildWikiNoResultsEmbed('quantum drive');

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('No Wiki Results');
    expect(embed.data.description).toContain('quantum drive');
  });

  it('truncates an overly long query', () => {
    const embed = buildWikiNoResultsEmbed('a'.repeat(200));

    // truncate() appends a U+2026 ellipsis once the 80-char cap is exceeded.
    expect(embed.data.description).toContain('\u2026');
  });
});

describe('buildWikiSearchEmbed', () => {
  const results: WikiSearchResultInput[] = [
    { title: 'Mining Guide', slug: 'mining-guide', snippet: 'How to **mine** quantanium.' },
    { title: 'Trading Guide', slug: 'trading-guide', snippet: null },
  ];

  it('renders an SC-blue list with a clickable wiki deep link', () => {
    const embed = buildWikiSearchEmbed('guide', results);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Wiki Search:');
    expect(embed.data.title).toContain('guide');
    expect(embed.data.url).toBe(buildAppUrl('/wiki'));
    expect(embed.data.url).toContain('/wiki');
  });

  it('lists each result and falls back when a snippet is missing', () => {
    const embed = buildWikiSearchEmbed('guide', results);

    expect(embed.data.description).toContain('Mining Guide');
    expect(embed.data.description).toContain('mining-guide');
    expect(embed.data.description).toContain('Trading Guide');
    expect(embed.data.description).toContain('No preview available.');
  });

  it('strips markdown from snippets', () => {
    const embed = buildWikiSearchEmbed('guide', results);

    expect(embed.data.description).toContain('How to mine quantanium.');
  });

  it('pluralizes the count and keeps the web URL in the footer', () => {
    const single: WikiSearchResultInput[] = [
      { title: 'Mining Guide', slug: 'mining-guide', snippet: 'x' },
    ];
    const one = buildWikiSearchEmbed('guide', single);
    const many = buildWikiSearchEmbed('guide', results);

    expect(one.data.footer?.text).toContain('1 result');
    expect(one.data.footer?.text).not.toContain('1 results');
    expect(many.data.footer?.text).toContain('2 results');
    expect(many.data.footer?.text).toContain(buildAppUrl('/wiki'));
  });
});

describe('buildWikiPageEmbed', () => {
  it('renders an SC-blue page with a clickable per-page deep link', () => {
    const embed = buildWikiPageEmbed(buildPage());

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Getting Started');
    expect(embed.data.url).toBe(buildAppUrl('/wiki/getting-started'));
  });

  it('strips markdown from the content preview', () => {
    const embed = buildWikiPageEmbed(buildPage({ content: 'Welcome to the **wiki**.' }));

    expect(embed.data.description).toContain('Welcome to the wiki.');
  });

  it('falls back when the page has no content', () => {
    const embed = buildWikiPageEmbed(buildPage({ content: null }));

    expect(embed.data.description).toContain('No content yet');
  });

  it('exposes slug, version, and an editable/locked status field', () => {
    const editable = buildWikiPageEmbed(buildPage({ isLocked: false }));
    const locked = buildWikiPageEmbed(buildPage({ isLocked: true }));

    expect(editable.data.fields?.find(f => f.name === 'Slug')?.value).toContain('getting-started');
    expect(editable.data.fields?.find(f => f.name === 'Version')?.value).toBe('3');
    expect(editable.data.fields?.find(f => f.name === 'Status')?.value).toContain('Editable');
    expect(locked.data.fields?.find(f => f.name === 'Status')?.value).toContain('Locked');
  });

  it('uses updatedAt as the timestamp and accepts both Date and string inputs', () => {
    const updatedAt = new Date('2026-06-12T12:34:56.000Z');
    const fromDate = buildWikiPageEmbed(buildPage({ updatedAt }));
    const fromString = buildWikiPageEmbed(buildPage({ updatedAt: updatedAt.toISOString() }));

    expect(fromDate.data.timestamp).toBe(updatedAt.toISOString());
    expect(fromString.data.timestamp).toBe(updatedAt.toISOString());
  });

  it('URL-encodes the slug in the deep link', () => {
    const embed = buildWikiPageEmbed(buildPage({ slug: 'a b/c' }));

    expect(embed.data.url).toBe(buildAppUrl('/wiki/a%20b%2Fc'));
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
