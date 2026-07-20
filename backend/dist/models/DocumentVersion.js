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
exports.DocumentVersion = void 0;
const typeorm_1 = require("typeorm");
const Document_1 = require("./Document");
let DocumentVersion = class DocumentVersion {
    id;
    documentId;
    version;
    blobPath;
    fileSize;
    changeNote;
    uploadedBy;
    document;
    createdAt;
};
exports.DocumentVersion = DocumentVersion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DocumentVersion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], DocumentVersion.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], DocumentVersion.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000 }),
    __metadata("design:type", String)
], DocumentVersion.prototype, "blobPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", Number)
], DocumentVersion.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], DocumentVersion.prototype, "changeNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], DocumentVersion.prototype, "uploadedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Document_1.Document, d => d.versions, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'documentId' }),
    __metadata("design:type", Document_1.Document)
], DocumentVersion.prototype, "document", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DocumentVersion.prototype, "createdAt", void 0);
exports.DocumentVersion = DocumentVersion = __decorate([
    (0, typeorm_1.Entity)('document_versions'),
    (0, typeorm_1.Index)(['documentId', 'version'])
], DocumentVersion);
//# sourceMappingURL=DocumentVersion.js.map