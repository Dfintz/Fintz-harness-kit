import { buildEventMirrorSubPanelEmbed } from '../eventsEmbeds';

describe('eventsEmbeds', () => {
  it('buildEventMirrorSubPanelEmbed preserves mirror subpanel contract', () => {
    const embed = buildEventMirrorSubPanelEmbed();

    expect(embed.data.color).toBe(0x9b59b6);
    expect(embed.data.title).toBe('🪞 Event Mirroring');
    expect(embed.data.description).toBe(
      '**Create Mirror** — Select one of your events and generate an invite code that others can use to mirror it.\n\n' +
        '**Post Mirror** — Enter an invite code (and password if needed) to post a mirrored event in this channel.'
    );
    expect(embed.data.footer).toBeUndefined();
    expect(embed.data.timestamp).toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
