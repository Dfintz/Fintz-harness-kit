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
exports.RsiCrawledMember = void 0;
const typeorm_1 = require("typeorm");
let RsiCrawledMember = class RsiCrawledMember {
    id;
    organizationSid;
    handle;
    displayName;
    rank;
    stars;
    isMain;
    isAffiliate;
    isHidden;
    isRedacted;
    avatar;
    enlisted;
    roles;
    firstCrawledAt;
    lastCrawledAt;
    crawlError;
    crawlFailed;
};
exports.RsiCrawledMember = RsiCrawledMember;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "organizationSid", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "handle", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "displayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], RsiCrawledMember.prototype, "stars", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCrawledMember.prototype, "isMain", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCrawledMember.prototype, "isAffiliate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCrawledMember.prototype, "isHidden", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCrawledMember.prototype, "isRedacted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "avatar", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "enlisted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], RsiCrawledMember.prototype, "roles", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiCrawledMember.prototype, "firstCrawledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], RsiCrawledMember.prototype, "lastCrawledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RsiCrawledMember.prototype, "crawlError", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCrawledMember.prototype, "crawlFailed", void 0);
exports.RsiCrawledMember = RsiCrawledMember = __decorate([
    (0, typeorm_1.Entity)('rsi_crawled_members'),
    (0, typeorm_1.Index)(['organizationSid', 'handle']),
    (0, typeorm_1.Index)(['lastCrawledAt'])
], RsiCrawledMember);
//# sourceMappingURL=RsiCrawledMember.js.map