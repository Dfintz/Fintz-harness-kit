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
exports.ExportRequest = exports.ExportRequestStatus = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
var ExportRequestStatus;
(function (ExportRequestStatus) {
    ExportRequestStatus["PENDING"] = "pending";
    ExportRequestStatus["PROCESSING"] = "processing";
    ExportRequestStatus["COMPLETED"] = "completed";
    ExportRequestStatus["FAILED"] = "failed";
    ExportRequestStatus["EXPIRED"] = "expired";
})(ExportRequestStatus || (exports.ExportRequestStatus = ExportRequestStatus = {}));
let ExportRequest = class ExportRequest {
    id;
    userId;
    user;
    status;
    requestedAt;
    processingStartedAt;
    completedAt;
    expiresAt;
    requestIpAddress;
    requestUserAgent;
    failureReason;
    filePath;
    fileSize;
    downloadToken;
    notificationSent;
    exportMetadata;
    createdAt;
    updatedAt;
};
exports.ExportRequest = ExportRequest;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ExportRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], ExportRequest.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], ExportRequest.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ExportRequestStatus,
        default: ExportRequestStatus.PENDING,
    }),
    __metadata("design:type", String)
], ExportRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], ExportRequest.prototype, "requestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ExportRequest.prototype, "processingStartedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ExportRequest.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ExportRequest.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 45, nullable: true }),
    __metadata("design:type", String)
], ExportRequest.prototype, "requestIpAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], ExportRequest.prototype, "requestUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ExportRequest.prototype, "failureReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], ExportRequest.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ExportRequest.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true }),
    __metadata("design:type", String)
], ExportRequest.prototype, "downloadToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ExportRequest.prototype, "notificationSent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ExportRequest.prototype, "exportMetadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExportRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ExportRequest.prototype, "updatedAt", void 0);
exports.ExportRequest = ExportRequest = __decorate([
    (0, typeorm_1.Entity)('export_requests'),
    (0, typeorm_1.Index)(['userId', 'status']),
    (0, typeorm_1.Index)(['expiresAt'])
], ExportRequest);
//# sourceMappingURL=ExportRequest.js.map