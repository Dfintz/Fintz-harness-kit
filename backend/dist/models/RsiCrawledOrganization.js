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
exports.RsiCrawledOrganization = void 0;
const typeorm_1 = require("typeorm");
let RsiCrawledOrganization = class RsiCrawledOrganization {
    sid;
    name;
    description;
    banner;
    logo;
    archetype;
    commitment;
    roleplay;
    memberCount;
    affiliateCount;
    focus;
    recruiting;
    language;
    exclusive;
    links;
    firstCrawledAt;
    lastCrawledAt;
    crawlError;
    crawlFailed;
};
exports.RsiCrawledOrganization = RsiCrawledOrganization;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "sid", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "banner", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "logo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "archetype", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "commitment", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "roleplay", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], RsiCrawledOrganization.prototype, "memberCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], RsiCrawledOrganization.prototype, "affiliateCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RsiCrawledOrganization.prototype, "focus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "recruiting", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "language", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "exclusive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RsiCrawledOrganization.prototype, "links", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiCrawledOrganization.prototype, "firstCrawledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], RsiCrawledOrganization.prototype, "lastCrawledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledOrganization.prototype, "crawlError", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCrawledOrganization.prototype, "crawlFailed", void 0);
exports.RsiCrawledOrganization = RsiCrawledOrganization = __decorate([
    (0, typeorm_1.Entity)('rsi_crawled_organizations'),
    (0, typeorm_1.Index)(['sid']),
    (0, typeorm_1.Index)(['lastCrawledAt'])
], RsiCrawledOrganization);
//# sourceMappingURL=RsiCrawledOrganization.js.map