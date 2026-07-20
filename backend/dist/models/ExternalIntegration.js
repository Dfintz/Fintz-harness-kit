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
exports.ExternalIntegration = exports.SyncDirection = exports.IntegrationStatus = exports.IntegrationType = void 0;
const typeorm_1 = require("typeorm");
const credentialEncryption_1 = require("../utils/credentialEncryption");
var IntegrationType;
(function (IntegrationType) {
    IntegrationType["WEBHOOK"] = "webhook";
    IntegrationType["REST_API"] = "rest_api";
    IntegrationType["GRAPHQL"] = "graphql";
    IntegrationType["DATABASE"] = "database";
    IntegrationType["STARCOMMS"] = "starcomms";
    IntegrationType["CUSTOM"] = "custom";
})(IntegrationType || (exports.IntegrationType = IntegrationType = {}));
var IntegrationStatus;
(function (IntegrationStatus) {
    IntegrationStatus["ACTIVE"] = "active";
    IntegrationStatus["INACTIVE"] = "inactive";
    IntegrationStatus["ERROR"] = "error";
    IntegrationStatus["PENDING"] = "pending";
})(IntegrationStatus || (exports.IntegrationStatus = IntegrationStatus = {}));
var SyncDirection;
(function (SyncDirection) {
    SyncDirection["INBOUND"] = "inbound";
    SyncDirection["OUTBOUND"] = "outbound";
    SyncDirection["BIDIRECTIONAL"] = "bidirectional";
})(SyncDirection || (exports.SyncDirection = SyncDirection = {}));
let ExternalIntegration = class ExternalIntegration {
    id;
    fleetId;
    ownerType;
    ownerId;
    name;
    description;
    type;
    status;
    syncDirection;
    authConfig;
    webhookConfig;
    apiConfig;
    starCommsConfig;
    fieldMappings;
    autoSync;
    syncIntervalMinutes;
    lastSyncAt;
    nextSyncAt;
    syncHistory;
    totalSyncs;
    successfulSyncs;
    failedSyncs;
    syncedCategories;
    enabled;
    errorMessage;
    lastErrorAt;
    createdBy;
    notes;
    createdAt;
    updatedAt;
};
exports.ExternalIntegration = ExternalIntegration;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "ownerType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
    }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: IntegrationStatus.PENDING,
    }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
    }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "syncDirection", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', {
        transformer: {
            to: (value) => {
                if (!value) {
                    return value;
                }
                return (0, credentialEncryption_1.encryptAuthConfig)(value);
            },
            from: (value) => {
                if (!value) {
                    return value;
                }
                return (0, credentialEncryption_1.decryptAuthConfig)(value);
            },
        },
    }),
    __metadata("design:type", Object)
], ExternalIntegration.prototype, "authConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ExternalIntegration.prototype, "webhookConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ExternalIntegration.prototype, "apiConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ExternalIntegration.prototype, "starCommsConfig", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], ExternalIntegration.prototype, "fieldMappings", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ExternalIntegration.prototype, "autoSync", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], ExternalIntegration.prototype, "syncIntervalMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ExternalIntegration.prototype, "lastSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ExternalIntegration.prototype, "nextSyncAt", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], ExternalIntegration.prototype, "syncHistory", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ExternalIntegration.prototype, "totalSyncs", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ExternalIntegration.prototype, "successfulSyncs", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ExternalIntegration.prototype, "failedSyncs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], ExternalIntegration.prototype, "syncedCategories", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ExternalIntegration.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ExternalIntegration.prototype, "lastErrorAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ExternalIntegration.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ExternalIntegration.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ExternalIntegration.prototype, "updatedAt", void 0);
exports.ExternalIntegration = ExternalIntegration = __decorate([
    (0, typeorm_1.Entity)('external_integrations')
], ExternalIntegration);
//# sourceMappingURL=ExternalIntegration.js.map