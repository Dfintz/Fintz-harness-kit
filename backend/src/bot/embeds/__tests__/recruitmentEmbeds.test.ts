import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildApplicantChannelReceivedEmbed,
  buildApplicationConfirmationEmbed,
  buildClosedRecruitmentPanelEmbed,
  buildDecisionNoticeEmbed,
  buildDiscordAccountLinkPromptEmbed,
  buildMultiQuickApplyEmbed,
  buildMyApplicationsView,
  buildRecruitmentDetailsEmbed,
  buildRecruitmentPanelEmbed,
  buildSingleQuickApplyEmbed,
  buildStaffReviewEmbed,
  buildViewPositionsEmbed,
  getRecruitmentStatusEmoji,
  type MyApplicationView,
  type RecruitmentEmbedItem,
  type StaffReviewThreadInput,
} from '../recruitmentEmbeds';

const fieldNames = (embed: { data: { fields?: { name: string }[] } }): string[] =>
  (embed.data.fields ?? []).map(field => field.name);

const fieldValue = (
  embed: { data: { fields?: { name: string; value: string }[] } },
  name: string
): string | undefined => (embed.data.fields ?? []).find(field => field.name === name)?.value;

describe('getRecruitmentStatusEmoji', () => {
  it('maps each status to its indicator emoji', () => {
    expect(getRecruitmentStatusEmoji('open')).toBe('\u{1F7E2}');
    expect(getRecruitmentStatusEmoji('paused')).toBe('\u{1F7E1}');
    expect(getRecruitmentStatusEmoji('closed')).toBe('\u{1F534}');
    expect(getRecruitmentStatusEmoji('whatever')).toBe('\u{1F534}');
  });
});

describe('buildViewPositionsEmbed', () => {
  it('uses the OPEN theme and lists each position with roles + applicant count', () => {
    const items: RecruitmentEmbedItem[] = [
      {
        title: 'Pilot',
        status: 'open',
        description: 'Fly ships',
        rolesNeeded: ['Pilot'],
        currentApplicants: 2,
        maxPositions: 5,
      },
    ];
    const embed = buildViewPositionsEmbed(items);

    expect(embed.data.color).toBe(EmbedColors.OPEN);
    expect(embed.data.title).toContain('Open Recruitment Positions');
    expect(embed.data.description).toContain('1 position(s)');
    expect(fieldValue(embed, '\u{1F7E2} Pilot')).toContain('Roles: Pilot');
    expect(fieldValue(embed, '\u{1F7E2} Pilot')).toContain('Applicants: 2/5');
  });

  it('caps the listing at 10 positions', () => {
    const many: RecruitmentEmbedItem[] = Array.from({ length: 15 }, (_, i) => ({
      title: `Role ${i}`,
      status: 'open',
    }));

    expect(buildViewPositionsEmbed(many).data.fields).toHaveLength(10);
  });

  it('renders the applicant count via formatApplicantCount (keeps /0 when maxPositions is 0)', () => {
    const embed = buildViewPositionsEmbed([
      { title: 'Role', status: 'open', currentApplicants: 3, maxPositions: 0 },
    ]);

    expect(embed.data.fields?.[0]?.value).toContain('Applicants: 3/0');
  });
});

describe('buildSingleQuickApplyEmbed', () => {
  it('uses the OPEN theme with roles + applicants fields and a footer', () => {
    const embed = buildSingleQuickApplyEmbed({
      title: 'Engineer',
      status: 'open',
      description: 'Fix things',
      rolesNeeded: ['Engineer'],
      currentApplicants: 1,
      maxPositions: 3,
    });

    expect(embed.data.color).toBe(EmbedColors.OPEN);
    expect(embed.data.title).toContain('Engineer');
    expect(fieldValue(embed, '\u{1F3AF} Roles')).toBe('Engineer');
    expect(fieldValue(embed, '\u{1F465} Applicants')).toBe('1/3');
    expect(embed.data.footer?.text).toContain('Click Apply');
  });

  it('omits the max when maxPositions is 0 (inline truthy check diverges from formatApplicantCount)', () => {
    const embed = buildSingleQuickApplyEmbed({
      title: 'Engineer',
      status: 'open',
      currentApplicants: 4,
      maxPositions: 0,
    });

    expect(fieldValue(embed, '\u{1F465} Applicants')).toBe('4');
  });

  it('falls back to a default description when none is provided', () => {
    const embed = buildSingleQuickApplyEmbed({ title: 'Engineer', status: 'open' });

    expect(embed.data.description).toBe('No description');
  });
});

describe('buildMultiQuickApplyEmbed', () => {
  it('uses the OPEN theme and a compact field per position', () => {
    const embed = buildMultiQuickApplyEmbed([
      {
        title: 'Medic',
        status: 'open',
        rolesNeeded: ['Medic'],
        currentApplicants: 0,
        maxPositions: 2,
      },
    ]);

    expect(embed.data.color).toBe(EmbedColors.OPEN);
    expect(embed.data.title).toContain('Quick Apply');
    expect(fieldNames(embed)[0]).toContain('Medic');
    expect(embed.data.fields?.[0]?.value).toContain('0/2');
  });
});

describe('buildDiscordAccountLinkPromptEmbed', () => {
  it('uses the warning theme and embeds the prompt message + next steps', () => {
    const embed = buildDiscordAccountLinkPromptEmbed('Link your account.');

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('Discord Account Not Linked');
    expect(embed.data.description).toContain('Link your account.');
    expect(embed.data.description).toContain('apply again');
    expect(embed.data.description).toContain('1\uFE0F\u20E3');
  });
});

describe('buildDecisionNoticeEmbed', () => {
  it('renders the decision sentence with the provided color and title', () => {
    const embed = buildDecisionNoticeEmbed(
      EmbedColors.SUCCESS,
      'Application Accepted',
      'CitizenJane',
      'accepted',
      'Officer'
    );

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('Application Accepted');
    expect(embed.data.description).toBe('**CitizenJane** has been accepted by Officer');
  });
});

describe('buildApplicantChannelReceivedEmbed', () => {
  it('preserves welcome embed color, title, description, and timestamp', () => {
    const embed = buildApplicantChannelReceivedEmbed('user-1', 'role-1');

    expect(embed.data.color).toBe(0x00aaff);
    expect(embed.data.title).toBe('\u{1F4E8} Application received');
    expect(embed.data.description).toBe(
      'Hi <@user-1>! Your application has been received. A recruiter ' +
        '(<@&role-1>) will reach out here shortly \u2014 feel free to add anything in the meantime.'
    );
    expect(embed.data.timestamp).toBeDefined();
  });
});

describe('buildRecruitmentPanelEmbed', () => {
  it('uses OPEN, sets the posting URL, and renders the core fields', () => {
    const embed = buildRecruitmentPanelEmbed({
      id: 'rec-1',
      title: 'Pilots Wanted',
      description: 'Join us',
      rolesNeeded: ['Pilot'],
      currentApplicants: 2,
      maxPositions: 5,
    });

    expect(embed.data.color).toBe(EmbedColors.OPEN);
    expect(embed.data.title).toContain('Pilots Wanted');
    expect(embed.data.url).toContain('/recruitment/rec-1');
    expect(fieldValue(embed, '\u{1F3AF} Roles Needed')).toBe('Pilot');
    expect(fieldValue(embed, '\u{1F465} Applicants')).toBe('2 / 5');
  });

  it('sets the org author icon only for an http logo url', () => {
    const withLogo = buildRecruitmentPanelEmbed({
      id: 'x',
      title: 'T',
      organizationName: 'Org',
      organizationLogoUrl: 'https://e/x.png',
    });
    expect(withLogo.data.author?.name).toBe('Org');
    expect(withLogo.data.author?.icon_url).toBe('https://e/x.png');

    const noUrl = buildRecruitmentPanelEmbed({
      id: 'x',
      title: 'T',
      organizationName: 'Org',
      organizationLogoUrl: 'not-a-url',
    });
    expect(noUrl.data.author?.icon_url).toBeUndefined();
  });
});

describe('buildClosedRecruitmentPanelEmbed', () => {
  it('uses CLOSED and the paused/closed status label', () => {
    const paused = buildClosedRecruitmentPanelEmbed({ id: 'r', title: 'T', status: 'paused' });
    expect(paused.data.color).toBe(EmbedColors.CLOSED);
    expect(paused.data.title).toContain('Paused');

    const closed = buildClosedRecruitmentPanelEmbed({ id: 'r', title: 'T', status: 'closed' });
    expect(closed.data.title).toContain('Closed');
  });
});

describe('buildRecruitmentDetailsEmbed', () => {
  it('uses OPEN for open status and ERROR otherwise', () => {
    const open = buildRecruitmentDetailsEmbed({
      id: 'r',
      status: 'open',
      title: 'T',
      description: 'D',
    });
    expect(open.data.color).toBe(EmbedColors.OPEN);

    const closed = buildRecruitmentDetailsEmbed({
      id: 'r',
      status: 'closed',
      title: 'T',
      description: 'D',
    });
    expect(closed.data.color).toBe(EmbedColors.ERROR);
  });

  it('renders status/applicants/organization + conditional roles bullets', () => {
    const embed = buildRecruitmentDetailsEmbed({
      id: 'r',
      status: 'open',
      title: 'T',
      description: 'D',
      currentApplicants: 1,
      maxPositions: 3,
      organizationName: 'Org',
      rolesNeeded: ['A', 'B'],
    });

    expect(fieldValue(embed, '\u{1F4CA} Status')).toBe('open');
    expect(fieldValue(embed, '\u{1F465} Applicants')).toBe('1 / 3');
    expect(fieldValue(embed, '\u{1F3E2} Organization')).toBe('Org');
    expect(fieldValue(embed, '\u{1F3AF} Roles Needed')).toContain('\u2022 A');
  });
});

describe('buildApplicationConfirmationEmbed', () => {
  it('uses SUCCESS color, the checkmark title, and the status footer', () => {
    const embed = buildApplicationConfirmationEmbed({ discordUserId: '1', discordUsername: 'u' });
    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('\u2705 Application Submitted!');
    expect(embed.data.footer?.text).toBe('Use /recruitment my-applications to check your status');
    expect(embed.data.fields ?? []).toHaveLength(0);
  });

  it('renders profile fields and answer fields when present', () => {
    const embed = buildApplicationConfirmationEmbed({
      discordUserId: '1',
      discordUsername: 'u',
      rsiHandle: 'Ace',
      timezone: 'UTC',
      availablePlaytimes: ['Evenings'],
      preferredRoles: ['Pilot'],
      answers: [{ questionId: 'q1', question: 'Why?', answer: 'Fun' }],
    });
    expect(fieldValue(embed, '\u{1F3AE} RSI Handle')).toBe('Ace');
    expect(fieldValue(embed, '\u{1F30D} Timezone')).toBe('UTC');
    expect(fieldValue(embed, '\u23f0 Availability')).toBe('Evenings');
    expect(fieldValue(embed, '\u{1F3AF} Preferred Roles')).toBe('Pilot');
    expect(fieldValue(embed, 'Why?')).toBe('Fun');
  });

  it('falls back to the message field when there are no answers', () => {
    const embed = buildApplicationConfirmationEmbed({
      discordUserId: '1',
      discordUsername: 'u',
      message: 'Hello',
    });
    expect(fieldValue(embed, '\u{1F4AC} Message')).toBe('Hello');
  });
});

describe('buildStaffReviewEmbed', () => {
  it('uses WARNING color, the clipboard title, and a discord mention field', () => {
    const embed = buildStaffReviewEmbed('Recruit', 'rec-1', '42', {
      payload: { discordUserId: '42', discordUsername: 'Recruit' },
    });
    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toBe('\u{1F4CB} New Application: Recruit');
    expect(embed.data.description).toContain('rec-1');
    expect(fieldValue(embed, '\u{1F464} Discord')).toBe('<@42>');
  });

  it('prefers legacy summary values and filters legacy answer ids', () => {
    const reviewInput: StaffReviewThreadInput = {
      payload: {
        discordUserId: '42',
        discordUsername: 'Recruit',
        message: 'payload motivation',
        answers: [
          { questionId: 'legacy_experience', question: 'Exp', answer: 'skip me' },
          { questionId: 'q1', question: 'Real', answer: 'keep me' },
        ],
      },
      legacySummary: { experience: 'Veteran', motivation: 'Legacy motivation' },
    };
    const embed = buildStaffReviewEmbed('Recruit', 'rec-1', '42', reviewInput);
    expect(fieldValue(embed, '\u{1F4DD} Experience')).toBe('Veteran');
    expect(fieldValue(embed, '\u{1F4A1} Motivation')).toBe('Legacy motivation');
    expect(fieldNames(embed)).toContain('\u2753 Real');
    expect(fieldNames(embed)).not.toContain('\u2753 Exp');
  });
});

describe('buildMyApplicationsView', () => {
  const baseApp: MyApplicationView = {
    status: 'pending',
    recruitmentTitle: 'Pilot Corps',
    appliedAt: '2026-06-14T00:00:00.000Z',
  };

  it('uses SC_BLUE, the clipboard title, and the application-count description', () => {
    const { embeds } = buildMyApplicationsView([baseApp], 0);
    expect(embeds[0].data.color).toBe(EmbedColors.SC_BLUE);
    expect(embeds[0].data.title).toBe('\u{1F4CB} Your Applications');
    expect(embeds[0].data.description).toBe('You have submitted 1 application(s)');
  });

  it('prefixes each field with the application-status emoji and renders timestamps', () => {
    const { embeds } = buildMyApplicationsView(
      [
        { ...baseApp, status: 'accepted', recruitmentTitle: 'Pilot Corps' },
        {
          status: 'interview_scheduled',
          recruitmentTitle: 'Medic Wing',
          appliedAt: '2026-06-14T00:00:00.000Z',
          interviewScheduledAt: '2026-06-20T00:00:00.000Z',
        },
      ],
      0
    );
    const fields = embeds[0].data.fields ?? [];
    expect(fields[0].name).toBe('\u2705 Pilot Corps');
    expect(fields[0].value).toContain('Applied: <t:');
    expect(fields[1].name).toBe('\u{1F4C5} Medic Wing');
    expect(fields[1].value).toContain('\u{1F4C5} Interview: <t:');
  });

  it('falls back to "Unknown Position" when the title is empty', () => {
    const { embeds } = buildMyApplicationsView([{ ...baseApp, recruitmentTitle: '' }], 0);
    expect((embeds[0].data.fields ?? [])[0].name).toBe('\u23f3 Unknown Position');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
