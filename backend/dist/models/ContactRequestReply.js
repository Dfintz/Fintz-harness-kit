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
exports.ContactRequestReply = void 0;
const typeorm_1 = require("typeorm");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
const ContactRequest_1 = require("./ContactRequest");
const User_1 = require("./User");
let ContactRequestReply = class ContactRequestReply {
    id;
    contactRequestId;
    contactRequest;
    senderUserId;
    senderUser;
    message;
    isOrgReply;
    createdAt;
};
exports.ContactRequestReply = ContactRequestReply;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ContactRequestReply.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequestReply.prototype, "contactRequestId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ContactRequest_1.ContactRequest, contactRequest => contactRequest.replies, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'contactRequestId' }),
    __metadata("design:type", ContactRequest_1.ContactRequest)
], ContactRequestReply.prototype, "contactRequest", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ContactRequestReply.prototype, "senderUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'senderUserId' }),
    __metadata("design:type", User_1.User)
], ContactRequestReply.prototype, "senderUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', transformer: encryptionTransformer_1.encryptionTransformer }),
    __metadata("design:type", String)
], ContactRequestReply.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ContactRequestReply.prototype, "isOrgReply", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ContactRequestReply.prototype, "createdAt", void 0);
exports.ContactRequestReply = ContactRequestReply = __decorate([
    (0, typeorm_1.Entity)('contact_request_replies'),
    (0, typeorm_1.Index)(['contactRequestId', 'createdAt'])
], ContactRequestReply);
//# sourceMappingURL=ContactRequestReply.js.map