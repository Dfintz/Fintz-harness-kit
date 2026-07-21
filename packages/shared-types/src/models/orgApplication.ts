/**
 * Organization Application types — backward-compat re-exports.
 *
 * @deprecated Import from './application' instead.
 * This file re-exports unified Application types under legacy names.
 */
export {
  APPLICATION_STATUS_TRANSITIONS,
  ApplicantType,
  ApplicationStatus,
  // Canonical exports
  ApplicationTargetType,
  ORG_APPLICATION_STATUS_TRANSITIONS,
  // Backward-compat aliases
  OrgApplicationStatus,
  type ApplicationDto,
  type OrgApplicationDto,
} from './application.js';
