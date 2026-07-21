/**
 * Recruitment application status — the recruitment / job-listing application flow, which is
 * Activity-based (mirrors the backend `ApplicationStatus` enum in `Activity.ts`). This is distinct
 * from the org-join `ApplicationStatus` in `application.ts` (User→Org / Org→Alliance).
 *
 * These are the states a recruitment application's `status` can hold: the five reachable through the
 * recruitment endpoints (pending, under_review, interview_scheduled, accepted, rejected) plus
 * `withdrawn`, which the shared activity logic can set. `waitlisted` / `completed` are
 * job-listing-only and never appear for recruitment.
 *
 * Single source of truth — web consumes this directly; the Expo/Metro mobile app mirrors it locally
 * (it does not yet consume workspace packages).
 */
export const RECRUITMENT_APPLICATION_STATUSES = [
  'pending',
  'under_review',
  'interview_scheduled',
  'accepted',
  'rejected',
  'withdrawn',
] as const;

export type RecruitmentApplicationStatus = (typeof RECRUITMENT_APPLICATION_STATUSES)[number];
