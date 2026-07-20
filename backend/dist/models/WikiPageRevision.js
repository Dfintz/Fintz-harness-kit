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
exports.WikiPageRevision = void 0;
const typeorm_1 = require("typeorm");
const WikiPage_1 = require("./WikiPage");
let WikiPageRevision = class WikiPageRevision {
    id;
    pageId;
    page;
    content;
    editedBy;
    changeDescription;
    version;
    editedAt;
};
exports.WikiPageRevision = WikiPageRevision;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WikiPageRevision.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WikiPageRevision.prototype, "pageId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WikiPage_1.WikiPage, page => page.revisions, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'pageId' }),
    __metadata("design:type", WikiPage_1.WikiPage)
], WikiPageRevision.prototype, "page", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], WikiPageRevision.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], WikiPageRevision.prototype, "editedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], WikiPageRevision.prototype, "changeDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], WikiPageRevision.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WikiPageRevision.prototype, "editedAt", void 0);
exports.WikiPageRevision = WikiPageRevision = __decorate([
    (0, typeorm_1.Entity)('wiki_page_revisions'),
    (0, typeorm_1.Index)('idx_revision_page', ['pageId']),
    (0, typeorm_1.Index)('idx_revision_page_version', ['pageId', 'version'])
], WikiPageRevision);
//# sourceMappingURL=WikiPageRevision.js.map