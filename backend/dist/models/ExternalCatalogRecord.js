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
exports.ExternalCatalogRecord = exports.ExternalCatalogRecordType = exports.ExternalCatalogSource = void 0;
const typeorm_1 = require("typeorm");
var ExternalCatalogSource;
(function (ExternalCatalogSource) {
    ExternalCatalogSource["SCMDB"] = "scmdb";
    ExternalCatalogSource["SC_CRAFT"] = "sc-craft";
})(ExternalCatalogSource || (exports.ExternalCatalogSource = ExternalCatalogSource = {}));
var ExternalCatalogRecordType;
(function (ExternalCatalogRecordType) {
    ExternalCatalogRecordType["CONTRACT"] = "contract";
    ExternalCatalogRecordType["BLUEPRINT"] = "blueprint";
    ExternalCatalogRecordType["RESOURCE"] = "resource";
})(ExternalCatalogRecordType || (exports.ExternalCatalogRecordType = ExternalCatalogRecordType = {}));
let ExternalCatalogRecord = class ExternalCatalogRecord {
    id;
    source;
    recordType;
    externalId;
    displayName;
    category;
    sourceVersion;
    payloadHash;
    payload;
    isActive;
    firstSeenAt;
    lastSeenAt;
    lastSyncedAt;
    createdAt;
    updatedAt;
};
exports.ExternalCatalogRecord = ExternalCatalogRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "recordType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "externalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 128, nullable: true }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "sourceVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], ExternalCatalogRecord.prototype, "payloadHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], ExternalCatalogRecord.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ExternalCatalogRecord.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], ExternalCatalogRecord.prototype, "firstSeenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], ExternalCatalogRecord.prototype, "lastSeenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], ExternalCatalogRecord.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ExternalCatalogRecord.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], ExternalCatalogRecord.prototype, "updatedAt", void 0);
exports.ExternalCatalogRecord = ExternalCatalogRecord = __decorate([
    (0, typeorm_1.Entity)('external_catalog_records'),
    (0, typeorm_1.Index)(['source', 'recordType', 'externalId'], { unique: true }),
    (0, typeorm_1.Index)(['source', 'recordType', 'isActive']),
    (0, typeorm_1.Index)(['source', 'recordType', 'isActive', 'category'])
], ExternalCatalogRecord);
//# sourceMappingURL=ExternalCatalogRecord.js.map