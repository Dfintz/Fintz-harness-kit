import type { BestTimeWindow, GroupAvailabilityHeatmap } from '@sc-fleet-manager/shared-types';

import { buildAppUrl } from '../../utils/appUrls';
import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildAvailabilityHeatmapEmbed,
  buildBestTimesEmbed,
  buildConflictsListEmbed,
  buildMyConflictsEmbed,
  buildNoAvailabilityEmbed,
  buildNoConflictsEmbed,
  buildNoTimeWindowsEmbed,
  buildSetAvailabilityEmbed,
  type ConflictSummary,
  type UserConflictSummary,
} from '../scheduleEmbeds';

function buildWindow(overrides: Partial<BestTimeWindow> = {}): BestTimeWindow {
  return {
    dayOfWeek: 1,
    startMinute: 840,
    endMinute: 960,
    availableCount: 7,
    dayName: 'Monday',
    timeRange: '14:00-16:00',
    ...overrides,
  };
}

describe('buildNoTimeWindowsEmbed', () => {
  it('uses the warning theme and echoes the duration and attendee floor', () => {
    const embed = buildNoTimeWindowsEmbed(90, 5);

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('No Time Windows Found');
    expect(embed.data.description).toContain('90-minute');
    expect(embed.data.description).toContain('at least 5 attendees');
  });
});

describe('buildBestTimesEmbed', () => {
  const windows: BestTimeWindow[] = [
    buildWindow({ dayName: 'Monday', timeRange: '14:00-16:00', availableCount: 7 }),
    buildWindow({ dayName: 'Friday', timeRange: '20:00-22:00', availableCount: 5 }),
  ];

  it('renders an SC-blue list with a clickable calendar deep link', () => {
    const embed = buildBestTimesEmbed(windows, 120, 4);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Best Times');
    expect(embed.data.title).toContain('120min');
    expect(embed.data.title).toContain('4 people');
    expect(embed.data.url).toBe(buildAppUrl('/calendar'));
    expect(embed.data.url).toContain('/calendar');
  });

  it('lists each window with its day, time range, and available count', () => {
    const embed = buildBestTimesEmbed(windows, 120, 4);

    expect(embed.data.description).toContain('Monday');
    expect(embed.data.description).toContain('14:00-16:00');
    expect(embed.data.description).toContain('7 available');
    expect(embed.data.description).toContain('Friday');
    expect(embed.data.description).toContain('5 available');
  });

  it('numbers the windows in order and keeps the group-scheduling footer', () => {
    const embed = buildBestTimesEmbed(windows, 120, 4);

    expect(embed.data.description).toContain('**1.** Monday');
    expect(embed.data.description).toContain('**2.** Friday');
    expect(embed.data.footer?.text).toContain('Group Scheduling');
  });
});

describe('buildNoConflictsEmbed', () => {
  it('uses the success theme and echoes the date range', () => {
    const embed = buildNoConflictsEmbed('2026-04-20', '2026-04-25');

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toContain('No Conflicts');
    expect(embed.data.description).toContain('2026-04-20');
    expect(embed.data.description).toContain('2026-04-25');
  });
});

describe('buildConflictsListEmbed', () => {
  const conflicts: ConflictSummary[] = [
    { activityTitle: 'Mining Op', conflictType: 'full' },
    { activityTitle: 'Cargo Run', conflictType: 'partial' },
  ];

  it('renders a warning list with a clickable calendar deep link', () => {
    const embed = buildConflictsListEmbed(conflicts, 2, '2026-04-20', '2026-04-25');

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('Scheduling Conflicts');
    expect(embed.data.title).toContain('2026-04-20 to 2026-04-25');
    expect(embed.data.url).toBe(buildAppUrl('/calendar'));
  });

  it('lists each conflict and its type, with the count in the footer', () => {
    const embed = buildConflictsListEmbed(conflicts, 2, '2026-04-20', '2026-04-25');

    expect(embed.data.description).toContain('**1.** Mining Op');
    expect(embed.data.description).toContain('full conflict');
    expect(embed.data.description).toContain('**2.** Cargo Run');
    expect(embed.data.description).toContain('partial conflict');
    expect(embed.data.footer?.text).toContain('2 conflict(s) found');
  });

  it('falls back to "Event" for a missing title and caps the list at 10', () => {
    const many: ConflictSummary[] = Array.from({ length: 12 }, (_, i) => ({
      activityTitle: i === 0 ? '' : `Activity ${i}`,
      conflictType: 'adjacent',
    }));
    const embed = buildConflictsListEmbed(many, 12, '2026-04-20', '2026-04-25');

    expect(embed.data.description).toContain('**1.** Event');
    expect(embed.data.description).toContain('**10.**');
    expect(embed.data.description).not.toContain('**11.**');
  });
});

describe('buildSetAvailabilityEmbed', () => {
  it('renders the SC-blue guide with a body calendar link and no title link', () => {
    const embed = buildSetAvailabilityEmbed();

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Set Your Availability');
    expect(embed.data.description).toContain('Open Availability Grid');
    expect(embed.data.description).toContain(buildAppUrl('/calendar'));
    expect(embed.data.footer?.text).toContain('Group Scheduling');
    expect(embed.data.url).toBeUndefined();
  });
});

describe('buildNoAvailabilityEmbed', () => {
  it('uses the warning theme and links to the calendar', () => {
    const embed = buildNoAvailabilityEmbed();

    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toContain('Group Availability');
    expect(embed.data.description).toContain('No members have set');
    expect(embed.data.url).toBe(buildAppUrl('/calendar'));
  });
});

describe('buildAvailabilityHeatmapEmbed', () => {
  const heatmap: GroupAvailabilityHeatmap = {
    orgId: 'org-1',
    totalMembers: 4,
    cells: [
      { dayOfWeek: 1, hour: 14, count: 4, total: 4 },
      { dayOfWeek: 3, hour: 20, count: 1, total: 4 },
    ],
  };

  it('renders an SC-blue grid with day labels, legend, member count, and a deep link', () => {
    const embed = buildAvailabilityHeatmapEmbed(heatmap);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Group Availability Heatmap');
    expect(embed.data.description).toContain('Sun');
    expect(embed.data.description).toContain('Mon');
    expect(embed.data.description).toContain('few');
    expect(embed.data.description).toContain('most');
    expect(embed.data.description).toContain('(4 members)');
    expect(embed.data.url).toBe(buildAppUrl('/calendar'));
  });
});

function buildConflict(overrides: Partial<UserConflictSummary> = {}): UserConflictSummary {
  return {
    activityTitle: 'Mining Op',
    activityType: 'mission',
    scheduledStartDate: new Date('2026-04-20T14:00:00.000Z'),
    conflictReason: 'Overlaps with Cargo Run',
    ...overrides,
  };
}

describe('buildMyConflictsEmbed', () => {
  it('uses the error theme and renders a field per conflict when there are conflicts', () => {
    const embed = buildMyConflictsEmbed([buildConflict()], 1);

    expect(embed.data.color).toBe(EmbedColors.ERROR);
    expect(embed.data.title).toContain('Your Event Conflicts');
    expect(embed.data.description).toContain('You have 1 scheduling conflict(s).');
    const field = embed.data.fields?.find(f => f.name === '1. Mining Op');
    expect(field?.value).toContain('mission');
    expect(field?.value).toContain('Overlaps with Cargo Run');
    expect(embed.data.url).toBe(buildAppUrl('/calendar'));
  });

  it('uses the success theme and a clear message when there are no conflicts', () => {
    const embed = buildMyConflictsEmbed([], 0);

    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.description).toContain('no scheduling conflicts');
    expect(embed.data.fields ?? []).toHaveLength(0);
  });

  it('caps the fields at 10 and notes the overflow in the footer', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      buildConflict({ activityTitle: `Conflict ${i + 1}` })
    );
    const embed = buildMyConflictsEmbed(many, 12);

    expect(embed.data.fields).toHaveLength(10);
    expect(embed.data.footer?.text).toContain('Showing 10 of 12 conflicts');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
