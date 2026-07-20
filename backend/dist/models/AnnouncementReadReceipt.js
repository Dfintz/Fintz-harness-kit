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
exports.AnnouncementReadReceipt = void 0;
const typeorm_1 = require("typeorm");
const Announcement_1 = require("./Announcement");
let AnnouncementReadReceipt = class AnnouncementReadReceipt {
    id;
    announcementId;
    announcement;
    userId;
    readAt;
};
exports.AnnouncementReadReceipt = AnnouncementReadReceipt;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AnnouncementReadReceipt.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], AnnouncementReadReceipt.prototype, "announcementId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Announcement_1.Announcement, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'announcementId' }),
    __metadata("design:type", Announcement_1.Announcement)
], AnnouncementReadReceipt.prototype, "announcement", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AnnouncementReadReceipt.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AnnouncementReadReceipt.prototype, "readAt", void 0);
exports.AnnouncementReadReceipt = AnnouncementReadReceipt = __decorate([
    (0, typeorm_1.Entity)('announcement_read_receipts'),
    (0, typeorm_1.Unique)(['announcementId', 'userId']),
    (0, typeorm_1.Index)(['announcementId']),
    (0, typeorm_1.Index)(['userId'])
], AnnouncementReadReceipt);
//# sourceMappingURL=AnnouncementReadReceipt.js.map