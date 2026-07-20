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
exports.CommentLike = void 0;
const typeorm_1 = require("typeorm");
const Comment_1 = require("./Comment");
let CommentLike = class CommentLike {
    id;
    commentId;
    comment;
    userId;
    createdAt;
};
exports.CommentLike = CommentLike;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CommentLike.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], CommentLike.prototype, "commentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Comment_1.Comment, c => c.likes, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'commentId' }),
    __metadata("design:type", Comment_1.Comment)
], CommentLike.prototype, "comment", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], CommentLike.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CommentLike.prototype, "createdAt", void 0);
exports.CommentLike = CommentLike = __decorate([
    (0, typeorm_1.Entity)('comment_likes'),
    (0, typeorm_1.Index)(['commentId', 'userId'], { unique: true }),
    (0, typeorm_1.Index)(['userId'])
], CommentLike);
//# sourceMappingURL=CommentLike.js.map