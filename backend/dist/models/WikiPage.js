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
exports.WikiPage = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const WikiPageRevision_1 = require("./WikiPageRevision");
let WikiPage = class WikiPage extends TenantEntity_1.TenantEntity {
    id;
    title;
    slug;
    content;
    parentPageId;
    sortOrder;
    tags;
    version;
    isLocked;
    createdBy;
    lastEditedBy;
    federationId;
    federationVisibility;
    revisions;
    createdAt;
    updatedAt;
};
exports.WikiPage = WikiPage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WikiPage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], WikiPage.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], WikiPage.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: '' }),
    __metadata("design:type", String)
], WikiPage.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], WikiPage.prototype, "parentPageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], WikiPage.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], WikiPage.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], WikiPage.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], WikiPage.prototype, "isLocked", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], WikiPage.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], WikiPage.prototype, "lastEditedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], WikiPage.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true, default: 'members' }),
    __metadata("design:type", Object)
], WikiPage.prototype, "federationVisibility", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => WikiPageRevision_1.WikiPageRevision, revision => revision.page),
    __metadata("design:type", Array)
], WikiPage.prototype, "revisions", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WikiPage.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WikiPage.prototype, "updatedAt", void 0);
exports.WikiPage = WikiPage = __decorate([
    (0, typeorm_1.Entity)('wiki_pages'),
    (0, typeorm_1.Index)('idx_wiki_org_slug', ['organizationId', 'slug'], { unique: true }),
    (0, typeorm_1.Index)('idx_wiki_parent', ['parentPageId']),
    (0, typeorm_1.Index)('idx_wiki_org_created', ['organizationId', 'createdAt'])
], WikiPage);
//# sourceMappingURL=WikiPage.js.map