/**
 * Recruitment schema tests.
 *
 * Regression guard for the "Interview" applicant filter returning
 * "Failed to load applications": the Applicants tab sends
 * `?status=interview_scheduled`, which must pass `applicationQuery` validation
 * (it was previously omitted from `.valid(...)`, yielding a 400).
 */

import { recruitmentSchemas } from '../recruitmentSchemas';

describe('recruitmentSchemas.applicationQuery', () => {
  const validateStatus = (status: string) =>
    recruitmentSchemas.applicationQuery.validate({ status }, { abortEarly: false, convert: true });

  it.each(['pending', 'under_review', 'interview_scheduled', 'accepted', 'rejected', 'withdrawn'])(
    'accepts the reviewer-facing status "%s"',
    status => {
      expect(validateStatus(status).error).toBeUndefined();
    }
  );

  it('accepts interview_scheduled (regression: Interview filter returned 400)', () => {
    expect(validateStatus('interview_scheduled').error).toBeUndefined();
  });

  it('rejects an unknown status', () => {
    expect(validateStatus('bogus').error).toBeDefined();
  });

  it('allows an absent status (filter cleared / "All")', () => {
    expect(recruitmentSchemas.applicationQuery.validate({}).error).toBeUndefined();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});

describe('recruitmentSchemas.apply', () => {
  it('accepts Discord bot payload identity fields for guest applications', () => {
    const result = recruitmentSchemas.apply.validate({
      message: 'Ready to join',
      discordUserId: 'discord-user-id',
      discordUsername: 'guest_user',
      applicantName: 'Guest User',
      rsiHandle: 'GuestPilot',
    });

    expect(result.error).toBeUndefined();
  });
});
