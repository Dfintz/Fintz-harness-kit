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
exports.Document = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
let Document = class Document extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    folderId;
    mimeType;
    fileSize;
    blobPath;
    currentVersionId;
    downloadCount;
    isPublic;
    tags;
    createdBy;
    updatedBy;
    folder;
    versions;
    shares;
    createdAt;
    updatedAt;
    version;
    get isImage() {
        return this.mimeType.startsWith('image/');
    }
    get isPdf() {
        return this.mimeType === 'application/pdf';
    }
    get fileSizeMb() {
        return Number(this.fileSize) / (1024 * 1024);
    }
};
exports.Document = Document;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Document.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Document.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "folderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Document.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", Number)
], Document.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000 }),
    __metadata("design:type", String)
], Document.prototype, "blobPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "currentVersionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Document.prototype, "downloadCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Document.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], Document.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Document.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Document.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('DocumentFolder', { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'folderId' }),
    __metadata("design:type", Function)
], Document.prototype, "folder", void 0);
__decorate([
    (0, typeorm_1.OneToMany)('DocumentVersion', 'document'),
    __metadata("design:type", Array)
], Document.prototype, "versions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)('DocumentShare', 'document'),
    __metadata("design:type", Array)
], Document.prototype, "shares", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Document.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Document.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], Document.prototype, "version", void 0);
exports.Document = Document = __decorate([
    (0, typeorm_1.Entity)('documents'),
    (0, typeorm_1.Index)(['organizationId', 'folderId']),
    (0, typeorm_1.Index)(['organizationId', 'name']),
    (0, typeorm_1.Index)(['organizationId', 'mimeType']),
    (0, typeorm_1.Index)(['createdBy'])
], Document);
//# sourceMappingURL=Document.js.map