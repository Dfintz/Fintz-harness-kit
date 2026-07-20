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
exports.DocumentFolder = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const Document_1 = require("./Document");
let DocumentFolder = class DocumentFolder extends TenantEntity_1.TenantEntity {
    id;
    name;
    parentId;
    sortOrder;
    createdBy;
    parent;
    children;
    documents;
    createdAt;
};
exports.DocumentFolder = DocumentFolder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DocumentFolder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], DocumentFolder.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], DocumentFolder.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], DocumentFolder.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], DocumentFolder.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => DocumentFolder, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'parentId' }),
    __metadata("design:type", DocumentFolder)
], DocumentFolder.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DocumentFolder, f => f.parent),
    __metadata("design:type", Array)
], DocumentFolder.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Document_1.Document, d => d.folder),
    __metadata("design:type", Array)
], DocumentFolder.prototype, "documents", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DocumentFolder.prototype, "createdAt", void 0);
exports.DocumentFolder = DocumentFolder = __decorate([
    (0, typeorm_1.Entity)('document_folders'),
    (0, typeorm_1.Index)(['organizationId', 'parentId']),
    (0, typeorm_1.Index)(['organizationId', 'name'])
], DocumentFolder);
//# sourceMappingURL=DocumentFolder.js.map