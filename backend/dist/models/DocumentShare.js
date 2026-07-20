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
exports.DocumentShare = exports.SharePermission = void 0;
const typeorm_1 = require("typeorm");
const Document_1 = require("./Document");
var SharePermission;
(function (SharePermission) {
    SharePermission["VIEW"] = "view";
    SharePermission["DOWNLOAD"] = "download";
    SharePermission["EDIT"] = "edit";
})(SharePermission || (exports.SharePermission = SharePermission = {}));
let DocumentShare = class DocumentShare {
    id;
    documentId;
    sharedWithUserId;
    sharedWithRole;
    permission;
    sharedBy;
    expiresAt;
    document;
    createdAt;
    get isExpired() {
        if (!this.expiresAt) {
            return false;
        }
        return new Date() > this.expiresAt;
    }
};
exports.DocumentShare = DocumentShare;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DocumentShare.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], DocumentShare.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], DocumentShare.prototype, "sharedWithUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], DocumentShare.prototype, "sharedWithRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: SharePermission.VIEW }),
    __metadata("design:type", String)
], DocumentShare.prototype, "permission", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], DocumentShare.prototype, "sharedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], DocumentShare.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Document_1.Document, d => d.shares, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'documentId' }),
    __metadata("design:type", Document_1.Document)
], DocumentShare.prototype, "document", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DocumentShare.prototype, "createdAt", void 0);
exports.DocumentShare = DocumentShare = __decorate([
    (0, typeorm_1.Entity)('document_shares'),
    (0, typeorm_1.Index)(['documentId', 'sharedWithUserId']),
    (0, typeorm_1.Index)(['sharedWithUserId'])
], DocumentShare);
//# sourceMappingURL=DocumentShare.js.map