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
exports.DeletionRequest = exports.DeletionRequestStatus = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
const User_1 = require("./User");
var DeletionRequestStatus;
(function (DeletionRequestStatus) {
    DeletionRequestStatus["PENDING"] = "pending";
    DeletionRequestStatus["CANCELLED"] = "cancelled";
    DeletionRequestStatus["COMPLETED"] = "completed";
    DeletionRequestStatus["FAILED"] = "failed";
})(DeletionRequestStatus || (exports.DeletionRequestStatus = DeletionRequestStatus = {}));
let DeletionRequest = class DeletionRequest {
    id;
    userId;
    user;
    status;
    requestedAt;
    scheduledFor;
    completedAt;
    cancelledAt;
    cancelledBy;
    cancellationReason;
    requestIpAddress;
    requestUserAgent;
    failureReason;
    deletionPreview;
    createdAt;
    updatedAt;
};
exports.DeletionRequest = DeletionRequest;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], DeletionRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], DeletionRequest.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], DeletionRequest.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: DeletionRequestStatus,
        default: DeletionRequestStatus.PENDING,
    }),
    __metadata("design:type", String)
], DeletionRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], DeletionRequest.prototype, "requestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], DeletionRequest.prototype, "scheduledFor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], DeletionRequest.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], DeletionRequest.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], DeletionRequest.prototype, "cancelledBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DeletionRequest.prototype, "cancellationReason", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address for GDPR audit' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], DeletionRequest.prototype, "requestIpAddress", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client device info for GDPR audit' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], DeletionRequest.prototype, "requestUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], DeletionRequest.prototype, "failureReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DeletionRequest.prototype, "deletionPreview", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DeletionRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DeletionRequest.prototype, "updatedAt", void 0);
exports.DeletionRequest = DeletionRequest = __decorate([
    (0, typeorm_1.Entity)('deletion_requests'),
    (0, typeorm_1.Index)(['userId', 'status'])
], DeletionRequest);
//# sourceMappingURL=DeletionRequest.js.map