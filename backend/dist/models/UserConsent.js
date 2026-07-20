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
exports.UserConsent = exports.ConsentType = void 0;
const typeorm_1 = require("typeorm");
const dataClassification_1 = require("../utils/dataClassification");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
const User_1 = require("./User");
var ConsentType;
(function (ConsentType) {
    ConsentType["ESSENTIAL"] = "essential";
    ConsentType["ANALYTICS"] = "analytics";
    ConsentType["MARKETING"] = "marketing";
    ConsentType["THIRD_PARTY"] = "third_party";
    ConsentType["DATA_PROCESSING"] = "data_processing";
})(ConsentType || (exports.ConsentType = ConsentType = {}));
let UserConsent = class UserConsent {
    id;
    userId;
    user;
    consentType;
    granted;
    purpose;
    version;
    ipAddress;
    userAgent;
    createdAt;
    updatedAt;
    expiresAt;
};
exports.UserConsent = UserConsent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserConsent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], UserConsent.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], UserConsent.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ConsentType
    }),
    __metadata("design:type", String)
], UserConsent.prototype, "consentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean' }),
    __metadata("design:type", Boolean)
], UserConsent.prototype, "granted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], UserConsent.prototype, "purpose", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], UserConsent.prototype, "version", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client IP address for consent audit' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], UserConsent.prototype, "ipAddress", void 0);
__decorate([
    (0, dataClassification_1.Classified)(dataClassification_1.DataClassification.CONFIDENTIAL, { reason: 'Client device info for consent audit' }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true, transformer: encryptionTransformer_1.conditionalEncryptionTransformer }),
    __metadata("design:type", String)
], UserConsent.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserConsent.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserConsent.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserConsent.prototype, "expiresAt", void 0);
exports.UserConsent = UserConsent = __decorate([
    (0, typeorm_1.Entity)('user_consents'),
    (0, typeorm_1.Index)(['userId', 'consentType'], { unique: true })
], UserConsent);
//# sourceMappingURL=UserConsent.js.map