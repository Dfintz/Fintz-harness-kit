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
exports.UserSocialConnection = exports.UserSocialConnectionStatus = exports.UserSocialConnectionType = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
var UserSocialConnectionType;
(function (UserSocialConnectionType) {
    UserSocialConnectionType["FRIEND"] = "friend";
    UserSocialConnectionType["FOLLOWER"] = "follower";
    UserSocialConnectionType["BLOCKED"] = "blocked";
})(UserSocialConnectionType || (exports.UserSocialConnectionType = UserSocialConnectionType = {}));
var UserSocialConnectionStatus;
(function (UserSocialConnectionStatus) {
    UserSocialConnectionStatus["PENDING"] = "pending";
    UserSocialConnectionStatus["ACCEPTED"] = "accepted";
    UserSocialConnectionStatus["REJECTED"] = "rejected";
})(UserSocialConnectionStatus || (exports.UserSocialConnectionStatus = UserSocialConnectionStatus = {}));
let UserSocialConnection = class UserSocialConnection {
    id;
    userId;
    user;
    targetUserId;
    targetUser;
    connectionType;
    status;
    createdAt;
    updatedAt;
    metadata;
};
exports.UserSocialConnection = UserSocialConnection;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserSocialConnection.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], UserSocialConnection.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], UserSocialConnection.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], UserSocialConnection.prototype, "targetUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'targetUserId' }),
    __metadata("design:type", User_1.User)
], UserSocialConnection.prototype, "targetUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: UserSocialConnectionType.FRIEND }),
    __metadata("design:type", String)
], UserSocialConnection.prototype, "connectionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: UserSocialConnectionStatus.PENDING }),
    __metadata("design:type", String)
], UserSocialConnection.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], UserSocialConnection.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], UserSocialConnection.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], UserSocialConnection.prototype, "metadata", void 0);
exports.UserSocialConnection = UserSocialConnection = __decorate([
    (0, typeorm_1.Entity)('user_social_connections'),
    (0, typeorm_1.Index)(['userId', 'targetUserId', 'connectionType'], { unique: true }),
    (0, typeorm_1.Index)(['targetUserId', 'connectionType', 'status']),
    (0, typeorm_1.Index)(['userId', 'connectionType', 'status'])
], UserSocialConnection);
//# sourceMappingURL=UserSocialConnection.js.map