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
exports.NotificationPreferences = exports.DEFAULT_CATEGORIES = exports.DEFAULT_CHANNELS = void 0;
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
exports.DEFAULT_CHANNELS = {
    inApp: true,
    email: false,
    discord: true,
};
exports.DEFAULT_CATEGORIES = {
    fleet: true,
    activity: true,
    organization: true,
    trade: true,
    social: true,
    security: true,
    lfg: true,
    system: true,
};
let NotificationPreferences = class NotificationPreferences {
    id;
    userId;
    user;
    muteAll;
    channels;
    categories;
    digestFrequency;
    createdAt;
    updatedAt;
};
exports.NotificationPreferences = NotificationPreferences;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], NotificationPreferences.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', unique: true }),
    (0, typeorm_1.Index)({ unique: true }),
    __metadata("design:type", String)
], NotificationPreferences.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], NotificationPreferences.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], NotificationPreferences.prototype, "muteAll", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => `'${JSON.stringify(exports.DEFAULT_CHANNELS)}'` }),
    __metadata("design:type", Object)
], NotificationPreferences.prototype, "channels", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => `'${JSON.stringify(exports.DEFAULT_CATEGORIES)}'` }),
    __metadata("design:type", Object)
], NotificationPreferences.prototype, "categories", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'daily' }),
    __metadata("design:type", String)
], NotificationPreferences.prototype, "digestFrequency", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], NotificationPreferences.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], NotificationPreferences.prototype, "updatedAt", void 0);
exports.NotificationPreferences = NotificationPreferences = __decorate([
    (0, typeorm_1.Entity)('notification_preferences')
], NotificationPreferences);
//# sourceMappingURL=NotificationPreferences.js.map