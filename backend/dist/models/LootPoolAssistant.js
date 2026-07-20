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
exports.LootPoolAssistant = void 0;
const typeorm_1 = require("typeorm");
let LootPoolAssistant = class LootPoolAssistant {
    id;
    organizationId;
    lootPoolId;
    userId;
    createdAt;
    updatedAt;
};
exports.LootPoolAssistant = LootPoolAssistant;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LootPoolAssistant.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], LootPoolAssistant.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], LootPoolAssistant.prototype, "lootPoolId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], LootPoolAssistant.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], LootPoolAssistant.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LootPoolAssistant.prototype, "updatedAt", void 0);
exports.LootPoolAssistant = LootPoolAssistant = __decorate([
    (0, typeorm_1.Entity)('loot_pool_assistants'),
    (0, typeorm_1.Index)(['organizationId', 'lootPoolId']),
    (0, typeorm_1.Index)(['lootPoolId', 'userId'], { unique: true })
], LootPoolAssistant);
//# sourceMappingURL=LootPoolAssistant.js.map