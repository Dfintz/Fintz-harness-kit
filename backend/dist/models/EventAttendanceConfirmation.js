"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventAttendanceConfirmation = exports.AttendanceStatus = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["ATTENDED"] = "attended";
    AttendanceStatus["NO_SHOW"] = "no_show";
    AttendanceStatus["LATE"] = "late";
    AttendanceStatus["EARLY_DEPARTURE"] = "early_departure";
    AttendanceStatus["PENDING_CONFIRMATION"] = "pending_confirmation";
})(AttendanceStatus || (exports.AttendanceStatus = AttendanceStatus = {}));
let EventAttendanceConfirmation = class EventAttendanceConfirmation extends TenantEntity_1.TenantEntity {
    id;
    eventId;
    userId;
    status;
    rsvpStatus;
    rsvpRole;
    actualRole;
    checkInTime;
    checkOutTime;
    durationMinutes;
    notes;
    feedbackFromOrganizer;
    performanceRating;
    confirmedBy;
    confirmedAt;
    autoConfirmed;
    excusedAbsence;
    absenceReason;
    notificationSent;
    createdAt;
    updatedAt;
    getAttendanceScore() {
        if (this.status === AttendanceStatus.ATTENDED) {
            return 100;
        }
        if (this.status === AttendanceStatus.LATE) {
            return 75;
        }
        if (this.status === AttendanceStatus.EARLY_DEPARTURE) {
            return 50;
        }
        if (this.status === AttendanceStatus.NO_SHOW && this.excusedAbsence) {
            return 25;
        }
        if (this.status === AttendanceStatus.NO_SHOW) {
            return 0;
        }
        return 0;
    }
    needsFollowUp() {
        return this.status === AttendanceStatus.PENDING_CONFIRMATION && !this.notificationSent;
    }
    getSummary() {
        return {
            id: this.id,
            eventId: this.eventId,
            userId: this.userId,
            status: this.status,
            rsvpStatus: this.rsvpStatus,
            rsvpRole: this.rsvpRole,
            actualRole: this.actualRole,
            attendanceScore: this.getAttendanceScore(),
            excusedAbsence: this.excusedAbsence,
            confirmedAt: this.confirmedAt?.toISOString(),
            confirmedBy: this.confirmedBy,
            durationMinutes: this.durationMinutes,
        };
    }
};
exports.EventAttendanceConfirmation = EventAttendanceConfirmation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: AttendanceStatus,
        default: AttendanceStatus.PENDING_CONFIRMATION,
    }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "rsvpStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "rsvpRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "actualRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], EventAttendanceConfirmation.prototype, "checkInTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], EventAttendanceConfirmation.prototype, "checkOutTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EventAttendanceConfirmation.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "feedbackFromOrganizer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], EventAttendanceConfirmation.prototype, "performanceRating", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "confirmedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], EventAttendanceConfirmation.prototype, "confirmedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EventAttendanceConfirmation.prototype, "autoConfirmed", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EventAttendanceConfirmation.prototype, "excusedAbsence", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EventAttendanceConfirmation.prototype, "absenceReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], EventAttendanceConfirmation.prototype, "notificationSent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EventAttendanceConfirmation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EventAttendanceConfirmation.prototype, "updatedAt", void 0);
exports.EventAttendanceConfirmation = EventAttendanceConfirmation = __decorate([
    (0, typeorm_1.Entity)('event_attendance_confirmations'),
    (0, typeorm_1.Index)(['organizationId', 'eventId']),
    (0, typeorm_1.Index)(['organizationId', 'userId']),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['eventId', 'userId']),
    (0, typeorm_1.Index)(['eventId', 'status']),
    (0, typeorm_1.Index)(['confirmedAt'])
], EventAttendanceConfirmation);
//# sourceMappingURL=EventAttendanceConfirmation.js.map