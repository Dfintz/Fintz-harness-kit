import { QueryFailedError } from 'typeorm';

const VERIFIED_CITIZEN_RECORD_CONSTRAINT = 'UQ_users_rsi_citizen_record_verified';

/**
 * Returns true when a DB error is the partial-unique violation used to enforce
 * one verified account per RSI citizen record.
 */
export function isVerifiedCitizenRecordConflict(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as
    | { code?: string; constraint?: string; detail?: string }
    | undefined;

  if (driverError?.code !== '23505') {
    return false;
  }

  if (driverError.constraint === VERIFIED_CITIZEN_RECORD_CONSTRAINT) {
    return true;
  }

  const detail = driverError.detail ?? '';
  return detail.includes(VERIFIED_CITIZEN_RECORD_CONSTRAINT);
}
