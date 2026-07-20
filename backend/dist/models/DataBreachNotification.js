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
exports.DataBreachNotification = exports.INCIDENT_STATUSES = void 0;
const typeorm_1 = require("typeorm");
exports.INCIDENT_STATUSES = ['INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED'];
let DataBreachNotification = class DataBreachNotification {
    id;
    title;
    description;
    severity;
    affectedUsers;
    affectedDataTypes;
    status;
    discoveredAt;
    containedAt;
    notifiedAt;
    resolvedAt;
    notifiedUsers;
    notificationErrors;
    remediationSteps;
    recommendations;
    internalNotes;
    regulatoryReport;
};
exports.DataBreachNotification = DataBreachNotification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DataBreachNotification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], DataBreachNotification.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], DataBreachNotification.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('enum', {
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium'
    }),
    __metadata("design:type", String)
], DataBreachNotification.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], DataBreachNotification.prototype, "affectedUsers", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], DataBreachNotification.prototype, "affectedDataTypes", void 0);
__decorate([
    (0, typeorm_1.Column)('enum', {
        enum: exports.INCIDENT_STATUSES,
        default: 'INVESTIGATING'
    }),
    __metadata("design:type", String)
], DataBreachNotification.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DataBreachNotification.prototype, "discoveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp', { nullable: true }),
    __metadata("design:type", Date)
], DataBreachNotification.prototype, "containedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp', { nullable: true }),
    __metadata("design:type", Date)
], DataBreachNotification.prototype, "notifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp', { nullable: true }),
    __metadata("design:type", Date)
], DataBreachNotification.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], DataBreachNotification.prototype, "notifiedUsers", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], DataBreachNotification.prototype, "notificationErrors", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], DataBreachNotification.prototype, "remediationSteps", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], DataBreachNotification.prototype, "recommendations", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], DataBreachNotification.prototype, "internalNotes", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], DataBreachNotification.prototype, "regulatoryReport", void 0);
exports.DataBreachNotification = DataBreachNotification = __decorate([
    (0, typeorm_1.Entity)('data_breach_notifications')
], DataBreachNotification);
//# sourceMappingURL=DataBreachNotification.js.map