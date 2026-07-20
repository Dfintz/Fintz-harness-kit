"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVerifiedCitizenRecordConflict = isVerifiedCitizenRecordConflict;
const typeorm_1 = require("typeorm");
const VERIFIED_CITIZEN_RECORD_CONSTRAINT = 'UQ_users_rsi_citizen_record_verified';
function isVerifiedCitizenRecordConflict(error) {
    if (!(error instanceof typeorm_1.QueryFailedError)) {
        return false;
    }
    const driverError = error.driverError;
    if (driverError?.code !== '23505') {
        return false;
    }
    if (driverError.constraint === VERIFIED_CITIZEN_RECORD_CONSTRAINT) {
        return true;
    }
    const detail = driverError.detail ?? '';
    return detail.includes(VERIFIED_CITIZEN_RECORD_CONSTRAINT);
}
//# sourceMappingURL=rsiVerificationDbConflict.js.map