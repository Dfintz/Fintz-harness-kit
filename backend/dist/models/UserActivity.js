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
exports.ActivityAction = exports.UserActivity = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
let UserActivity = class UserActivity {
    id;
    userId;
    user;
    action;
    resource;
    method;
    ipAddress;
    userAgent;
    metadata;
    statusCode;
    duration;
    timestamp;
};
exports.UserActivity = UserActivity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserActivity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserActivity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], UserActivity.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserActivity.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserActivity.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserActivity.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserActivity.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], UserActivity.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], UserActivity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], UserActivity.prototype, "statusCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], UserActivity.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserActivity.prototype, "timestamp", void 0);
exports.UserActivity = UserActivity = __decorate([
    (0, typeorm_1.Entity)('user_activities'),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['action']),
    (0, typeorm_1.Index)(['timestamp']),
    (0, typeorm_1.Index)(['userId', 'timestamp'])
], UserActivity);
var ActivityAction;
(function (ActivityAction) {
    ActivityAction["LOGIN"] = "auth.login";
    ActivityAction["LOGOUT"] = "auth.logout";
    ActivityAction["LOGIN_FAILED"] = "auth.login_failed";
    ActivityAction["TWO_FACTOR_ENABLED"] = "auth.2fa_enabled";
    ActivityAction["TWO_FACTOR_DISABLED"] = "auth.2fa_disabled";
    ActivityAction["USER_CREATED"] = "user.created";
    ActivityAction["USER_UPDATED"] = "user.updated";
    ActivityAction["USER_DELETED"] = "user.deleted";
    ActivityAction["PASSWORD_CHANGED"] = "user.password_changed";
    ActivityAction["EMAIL_CHANGED"] = "user.email_changed";
    ActivityAction["ROLE_CHANGED"] = "user.role_changed";
    ActivityAction["PASSWORD_RESET_REQUESTED"] = "auth.password_reset_requested";
    ActivityAction["PASSWORD_RESET_COMPLETED"] = "auth.password_reset_completed";
    ActivityAction["PASSWORD_RESET_FAILED"] = "auth.password_reset_failed";
    ActivityAction["PROFILE_VIEWED"] = "profile.viewed";
    ActivityAction["PROFILE_UPDATED"] = "profile.updated";
    ActivityAction["ORG_JOINED"] = "org.joined";
    ActivityAction["ORG_LEFT"] = "org.left";
    ActivityAction["ORG_CREATED"] = "org.created";
    ActivityAction["SECURITY_ALERT"] = "security.alert";
    ActivityAction["SUSPICIOUS_ACTIVITY"] = "security.suspicious";
    ActivityAction["ACCOUNT_LOCKED"] = "security.locked";
    ActivityAction["ACCOUNT_UNLOCKED"] = "security.unlocked";
})(ActivityAction || (exports.ActivityAction = ActivityAction = {}));
//# sourceMappingURL=UserActivity.js.map