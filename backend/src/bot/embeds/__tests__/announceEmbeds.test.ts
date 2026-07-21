import { type Announcement, AnnouncementStatus } from '../../../models/Announcement';
import { type AnnouncementTemplate } from '../../../models/AnnouncementTemplate';
import {
  type AllianceDeliveryResult,
  type AnnouncementStatusResult,
} from '../../../services/communication/announcement';
import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildAllianceDeliveryResultEmbed,
  buildAnnouncementCreatedEmbed,
  buildAnnouncementCreatedFromTemplateEmbed,
  buildAnnouncementListEmbed,
  buildAnnouncementScheduledEmbed,
  buildAnnouncementStatusEmbed,
  buildPreviewEmbed,
  buildTemplateCreatedEmbed,
  buildTemplatesListEmbed,
  buildTemplatesPanelEmbed,
  getStatusEmoji,
} from '../announceEmbeds';

describe('buildPreviewEmbed', () => {
  it('sets the title and description', () => {
    const embed = buildPreviewEmbed('Hello', 'World', {});

    expect(embed.data.title).toBe('Hello');
    expect(embed.data.description).toBe('World');
  });

  it('parses a hex color string (with #) into an int color', () => {
    const embed = buildPreviewEmbed('T', 'C', { color: '#0099FF' });

    expect(embed.data.color).toBe(0x0099ff);
  });

  it('parses a color without the leading hash', () => {
    const embed = buildPreviewEmbed('T', 'C', { color: 'FF0000' });

    expect(embed.data.color).toBe(0xff0000);
  });

  it('omits color/image/thumbnail/timestamp when not provided', () => {
    const embed = buildPreviewEmbed('T', 'C', {});

    expect(embed.data.color).toBeUndefined();
    expect(embed.data.image).toBeUndefined();
    expect(embed.data.thumbnail).toBeUndefined();
    expect(embed.data.timestamp).toBeUndefined();
  });

  it('applies image, thumbnail, and timestamp when provided', () => {
    const embed = buildPreviewEmbed('T', 'C', {
      imageUrl: 'http://img',
      thumbnailUrl: 'http://thumb',
      timestamp: true,
    });

    expect(embed.data.image?.url).toBe('http://img');
    expect(embed.data.thumbnail?.url).toBe('http://thumb');
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('getStatusEmoji', () => {
  it('maps each announcement status to its emoji', () => {
    expect(getStatusEmoji(AnnouncementStatus.DRAFT)).toBe('\u{1F4DD}');
    expect(getStatusEmoji(AnnouncementStatus.SCHEDULED)).toBe('\u{1F4C5}');
    expect(getStatusEmoji(AnnouncementStatus.SENDING)).toBe('\u23f3');
    expect(getStatusEmoji(AnnouncementStatus.SENT)).toBe('\u2705');
    expect(getStatusEmoji(AnnouncementStatus.FAILED)).toBe('\u274c');
    expect(getStatusEmoji(AnnouncementStatus.CANCELLED)).toBe('\u{1F6AB}');
  });
});

describe('buildAnnouncementCreatedEmbed', () => {
  it('brands SUCCESS (not raw 0x00ff00) and renders the created fields + footer', () => {
    const embed = buildAnnouncementCreatedEmbed('abc-123', 'Pilot');

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.color).not.toBe(0x00ff00);
    expect(embed.data.title).toContain('Announcement Created');
    const fields = embed.data.fields ?? [];
    expect(fields.find(f => f.name === 'Announcement ID')?.value).toBe('`abc-123`');
    expect(fields.find(f => f.name === 'Created By')?.value).toBe('Pilot');
    expect(fields.find(f => f.name === 'Status')?.value).toContain('Draft');
    expect(embed.data.footer?.text).toContain('abc-123');
  });
});

describe('buildAnnouncementCreatedFromTemplateEmbed', () => {
  it('brands SUCCESS, renders id + title fields, and has no footer', () => {
    const embed = buildAnnouncementCreatedFromTemplateEmbed('tmpl-9', 'Patch Notes');

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.color).not.toBe(0x00ff00);
    expect(embed.data.title).toContain('from Template');
    const fields = embed.data.fields ?? [];
    expect(fields.find(f => f.name === 'Announcement ID')?.value).toBe('`tmpl-9`');
    expect(fields.find(f => f.name === 'Title')?.value).toBe('Patch Notes');
    expect(fields.find(f => f.name === 'Status')?.value).toContain('Draft');
    expect(embed.data.footer).toBeUndefined();
  });
});

describe('buildAllianceDeliveryResultEmbed', () => {
  const base = {
    announcementId: 'ann-1',
    success: true,
    totalServers: 3,
    successfulDeliveries: 3,
    failedDeliveries: 0,
    pendingDeliveries: 0,
    deliveries: [],
    allianceOrgs: ['o1', 'o2', 'o3'],
    skippedOrgs: [],
    skippedReasons: {},
  } as AllianceDeliveryResult;

  it('brands SUCCESS on full success and renders the 4 fields', () => {
    const embed = buildAllianceDeliveryResultEmbed(base);

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toContain('Alliance Announcement Sent');
    const fields = embed.data.fields ?? [];
    expect(fields.find(f => f.name === 'Announcement ID')?.value).toBe('`ann-1`');
    expect(fields.find(f => f.name === 'Alliance Orgs')?.value).toBe('3');
    expect(fields.find(f => f.name === 'Successful')?.value).toBe('3');
    expect(fields.find(f => f.name === 'Failed')?.value).toBe('0');
  });

  it('brands WARNING on partial delivery', () => {
    const embed = buildAllianceDeliveryResultEmbed({
      ...base,
      success: false,
      successfulDeliveries: 1,
      failedDeliveries: 2,
    } as AllianceDeliveryResult);

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('Partial Alliance Delivery');
  });

  it('brands ERROR on total failure', () => {
    const embed = buildAllianceDeliveryResultEmbed({
      ...base,
      success: false,
      successfulDeliveries: 0,
      failedDeliveries: 3,
    } as AllianceDeliveryResult);

    expect(embed.data.color).toBe(EmbedColors.ERROR);
    expect(embed.data.title).toContain('Alliance Delivery Failed');
  });
});

describe('buildAnnouncementStatusEmbed', () => {
  const baseStatus = {
    announcement: {
      id: 'a-1',
      title: 'Maintenance',
      status: AnnouncementStatus.SENT,
      createdByName: 'Pilot',
      createdBy: 'user-1',
    },
    deliveries: [],
    summary: { total: 0, pending: 0, delivered: 0, failed: 0, cancelled: 0 },
  } as unknown as AnnouncementStatusResult;

  it('brands SC_BLUE, renders base fields, and omits the delivery summary when empty', () => {
    const embed = buildAnnouncementStatusEmbed(baseStatus);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.color).not.toBe(0x0099ff);
    expect(embed.data.title).toContain('Maintenance');
    const fields = embed.data.fields ?? [];
    expect(fields.find(f => f.name === 'ID')?.value).toBe('`a-1`');
    expect(fields.find(f => f.name === 'Created By')?.value).toBe('Pilot');
    expect(fields.some(f => f.name.includes('Delivery Summary'))).toBe(false);
  });

  it('adds the delivery summary block when deliveries exist', () => {
    const embed = buildAnnouncementStatusEmbed({
      ...baseStatus,
      deliveries: [{}],
      summary: { total: 5, pending: 0, delivered: 4, failed: 1, cancelled: 0 },
    } as unknown as AnnouncementStatusResult);

    const fields = embed.data.fields ?? [];
    expect(fields.some(f => f.name.includes('Delivery Summary'))).toBe(true);
    expect(fields.find(f => f.name === 'Total')?.value).toBe('5');
    expect(fields.find(f => f.name === 'Delivered')?.value).toContain('4');
    expect(fields.find(f => f.name === 'Failed')?.value).toContain('1');
  });
});

describe('buildAnnouncementListEmbed', () => {
  const makeAnnouncement = (id: string, title: string, content: string) =>
    ({
      id,
      title,
      content,
      status: AnnouncementStatus.DRAFT,
    }) as unknown as Announcement;

  it('brands SC_BLUE and renders one field per announcement', () => {
    const announcements = [
      makeAnnouncement('a1', 'First', 'Short content'),
      makeAnnouncement('a2', 'Second', 'Other content'),
    ];

    const embed = buildAnnouncementListEmbed(announcements, 5);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.color).not.toBe(0x0099ff);
    expect(embed.data.title).toContain('Announcements');
    expect(embed.data.description).toBe('Showing 2 of 5 announcements');
    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(2);
    expect(fields[0].name).toContain('First');
    expect(fields[0].value).toContain('`a1`');
    expect(fields[0].value).toContain('Short content');
  });

  it('truncates content longer than 50 characters', () => {
    const long = 'x'.repeat(80);
    const embed = buildAnnouncementListEmbed([makeAnnouncement('a3', 'Long', long)], 1);

    const fields = embed.data.fields ?? [];
    expect(fields[0].value).toContain(`${'x'.repeat(50)}...`);
    expect(fields[0].value).not.toContain('x'.repeat(51));
  });
});

describe('buildTemplatesPanelEmbed', () => {
  it('brands INFO (= 0x5865f2) and renders the static title/description/footer', () => {
    const embed = buildTemplatesPanelEmbed();

    expect(embed.data.color).toBe(EmbedColors.INFO);
    expect(embed.data.color).toBe(0x5865f2);
    expect(embed.data.title).toContain('Announcement Templates');
    expect(embed.data.description).toBe('Manage your announcement templates.');
    expect(embed.data.footer?.text).toContain('Templates let you quickly create');
  });
});

describe('buildTemplatesListEmbed', () => {
  const makeTemplate = (
    id: string,
    name: string,
    content: string,
    opts: { isGlobal?: boolean; title?: string } = {}
  ) =>
    ({
      id,
      name,
      content,
      title: opts.title,
      isGlobal: opts.isGlobal ?? false,
    }) as unknown as AnnouncementTemplate;

  it('brands SC_BLUE and renders one field per template with the global badge', () => {
    const templates = [
      makeTemplate('t1', 'Weekly', 'Weekly content', { title: 'Update', isGlobal: true }),
      makeTemplate('t2', 'Local', 'Local content'),
    ];

    const embed = buildTemplatesListEmbed(templates, 3);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.color).not.toBe(0x0099ff);
    expect(embed.data.description).toBe('Showing 2 of 3 templates');
    const fields = embed.data.fields ?? [];
    expect(fields).toHaveLength(2);
    expect(fields[0].name).toContain('Weekly');
    expect(fields[0].name).toContain('\u{1F310}');
    expect(fields[1].name).not.toContain('\u{1F310}');
    expect(fields[0].value).toContain('`t1`');
    expect(fields[0].value).toContain('Update');
  });

  it("shows 'N/A' for a template without a title", () => {
    const embed = buildTemplatesListEmbed([makeTemplate('t3', 'NoTitle', 'x')], 1);

    const fields = embed.data.fields ?? [];
    expect(fields[0].value).toContain('N/A');
  });
});

describe('buildAnnouncementScheduledEmbed', () => {
  it('brands SC_BLUE and renders the id, schedule time, channel mention, and footer', () => {
    const scheduledAt = new Date('2026-12-25T14:00:00Z');
    const embed = buildAnnouncementScheduledEmbed('ann-9', scheduledAt, 'chan-1');

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.color).not.toBe(0x0099ff);
    expect(embed.data.title).toContain('Announcement Scheduled');
    const fields = embed.data.fields ?? [];
    expect(fields.find(f => f.name === 'Announcement ID')?.value).toBe('`ann-9`');
    expect(fields.find(f => f.name === 'Scheduled For')?.value).toBe(scheduledAt.toLocaleString());
    expect(fields.find(f => f.name === 'Channel')?.value).toBe('<#chan-1>');
    expect(embed.data.footer?.text).toContain('cancel');
  });
});

describe('buildTemplateCreatedEmbed', () => {
  it('brands SUCCESS, includes the template name in the description, and renders the 3 fields', () => {
    const embed = buildTemplateCreatedEmbed('tpl-7', 'Weekly Update', 'Pilot');

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.color).not.toBe(0x00ff00);
    expect(embed.data.title).toContain('Template Created');
    expect(embed.data.description).toContain('Weekly Update');
    const fields = embed.data.fields ?? [];
    expect(fields.find(f => f.name === 'Template ID')?.value).toBe('`tpl-7`');
    expect(fields.find(f => f.name === 'Type')?.value).toContain('Organization');
    expect(fields.find(f => f.name === 'Created By')?.value).toBe('Pilot');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
