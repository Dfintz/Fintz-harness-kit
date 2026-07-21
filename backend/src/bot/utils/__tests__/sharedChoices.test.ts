import {
  buildBountyTypeSelect,
  buildEventDifficultySelect,
  buildEventTypeSelect,
  buildMissionStatusSelect,
} from '../sharedChoices';

describe('buildEventDifficultySelect', () => {
  it('builds a 4-option difficulty select with the correct id, placeholder, and values', () => {
    const row = buildEventDifficultySelect('event_wiz_select_difficulty');
    const data = row.components[0].toJSON();

    expect(data.custom_id).toBe('event_wiz_select_difficulty');
    expect(data.placeholder).toBe('Select difficulty');
    expect(data.options).toHaveLength(4);
    expect(data.options.map(o => o.value)).toEqual(['easy', 'medium', 'hard', 'expert']);
  });

  it('marks exactly the selected option as default when selectedValue is provided', () => {
    const row = buildEventDifficultySelect('id', 'hard');
    const data = row.components[0].toJSON();

    const defaults = data.options.filter(o => o.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].value).toBe('hard');
  });

  it('marks no option as default when selectedValue is omitted', () => {
    const row = buildEventDifficultySelect('id');
    const data = row.components[0].toJSON();

    expect(data.options.some(o => o.default)).toBe(false);
  });
});

describe('buildEventTypeSelect', () => {
  it('builds a 7-option activity-type select with the correct id, placeholder, and values', () => {
    const row = buildEventTypeSelect('event_wiz_select_type');
    const data = row.components[0].toJSON();

    expect(data.custom_id).toBe('event_wiz_select_type');
    expect(data.placeholder).toBe('Select activity type');
    expect(data.options).toHaveLength(7);
    expect(data.options.map(o => o.value)).toEqual([
      'event',
      'mission',
      'contract',
      'bounty',
      'operation',
      'lfg',
      'job_listing',
    ]);
  });

  it('marks exactly the selected option as default when selectedValue is provided', () => {
    const row = buildEventTypeSelect('id', 'mission');
    const data = row.components[0].toJSON();

    const defaults = data.options.filter(o => o.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].value).toBe('mission');
  });

  it('marks no option as default when selectedValue is omitted', () => {
    const row = buildEventTypeSelect('id');
    const data = row.components[0].toJSON();

    expect(data.options.some(o => o.default)).toBe(false);
  });
});

describe('buildSelectRow backward-compat (existing static builders)', () => {
  it('emits no default flag on any option for buildBountyTypeSelect', () => {
    const row = buildBountyTypeSelect('bounty_type');
    const data = row.components[0].toJSON();

    expect(data.options.every(o => o.default === undefined)).toBe(true);
  });

  it('builds mission status select with exact placeholder and 6-option contract', () => {
    const row = buildMissionStatusSelect('mission_status_select_m-1');
    const data = row.components[0].toJSON();

    expect(data.custom_id).toBe('mission_status_select_m-1');
    expect(data.placeholder).toBe('Select new status...');
    expect(data.options).toHaveLength(6);
    expect(data.options.map(o => o.label)).toEqual([
      'Planned',
      'Briefed',
      'In Progress',
      'Completed',
      'Failed',
      'Cancelled',
    ]);
    expect(data.options.map(o => o.value)).toEqual([
      'planned',
      'briefed',
      'in_progress',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(data.options.map(o => o.emoji?.name)).toEqual(['📋', '📑', '🚀', '✅', '❌', '🚫']);
    expect(data.options.every(o => o.default === undefined)).toBe(true);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
