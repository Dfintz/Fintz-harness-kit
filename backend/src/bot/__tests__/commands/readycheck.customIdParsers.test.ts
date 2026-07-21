import {
  READY_CHECK_VOTE_NOT_READY_PREFIX,
  READY_CHECK_VOTE_READY_PREFIX,
} from '../../../services/activity/ReadyCheckService';
import {
  parseReadycheckDurationModalActivityId,
  parseReadyCheckVoteCustomId,
} from '../../commands/readycheck';

describe('readycheck customId parser helpers (C9)', () => {
  it('parses duration-modal activity id', () => {
    expect(parseReadycheckDurationModalActivityId('readycheck_duration_modal_activity-1')).toBe(
      'activity-1'
    );
  });

  it('keeps permissive parsing for extra params', () => {
    expect(
      parseReadycheckDurationModalActivityId('readycheck_duration_modal_activity-1_extra')
    ).toBe('activity-1');
  });

  it('parses vote customIds for ready and not-ready responses', () => {
    expect(parseReadyCheckVoteCustomId(`${READY_CHECK_VOTE_READY_PREFIX}activity-1`)).toEqual({
      activityId: 'activity-1',
      response: 'ready',
    });
    expect(parseReadyCheckVoteCustomId(`${READY_CHECK_VOTE_NOT_READY_PREFIX}activity-2`)).toEqual({
      activityId: 'activity-2',
      response: 'not_ready',
    });
  });

  it('returns null for non-vote customIds', () => {
    expect(parseReadyCheckVoteCustomId('readycheck_start_select')).toBeNull();
    expect(parseReadycheckDurationModalActivityId('readycheck_duration_modal_')).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
