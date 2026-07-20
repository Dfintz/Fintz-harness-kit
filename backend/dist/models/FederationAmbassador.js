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
exports.FederationAmbassador = void 0;
const typeorm_1 = require("typeorm");
const Federation_1 = require("./Federation");
let FederationAmbassador = class FederationAmbassador {
    id;
    federationId;
    federation;
    organizationId;
    organizationName;
    userId;
    userName;
    role;
    permissions;
    isActive;
    isExternal;
    title;
    appointedAt;
};
exports.FederationAmbassador = FederationAmbassador;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FederationAmbassador.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FederationAmbassador.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Federation_1.Federation, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'federationId' }),
    __metadata("design:type", Federation_1.Federation)
], FederationAmbassador.prototype, "federation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], FederationAmbassador.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], FederationAmbassador.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], FederationAmbassador.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], FederationAmbassador.prototype, "userName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'representative' }),
    __metadata("design:type", Object)
], FederationAmbassador.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '["view"]' }),
    __metadata("design:type", Array)
], FederationAmbassador.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], FederationAmbassador.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], FederationAmbassador.prototype, "isExternal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], FederationAmbassador.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FederationAmbassador.prototype, "appointedAt", void 0);
exports.FederationAmbassador = FederationAmbassador = __decorate([
    (0, typeorm_1.Entity)('federation_ambassadors'),
    (0, typeorm_1.Index)('idx_fed_amb_federation', ['federationId']),
    (0, typeorm_1.Index)('idx_fed_amb_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_fed_amb_user', ['userId']),
    (0, typeorm_1.Index)('idx_fed_amb_unique', ['federationId', 'userId'], { unique: true })
], FederationAmbassador);
//# sourceMappingURL=FederationAmbassador.js.map