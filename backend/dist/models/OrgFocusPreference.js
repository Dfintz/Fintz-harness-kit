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
exports.OrgFocusPreference = void 0;
const typeorm_1 = require("typeorm");
let OrgFocusPreference = class OrgFocusPreference {
    id;
    orgId;
    focuses;
    createdAt;
    updatedAt;
};
exports.OrgFocusPreference = OrgFocusPreference;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrgFocusPreference.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrgFocusPreference.prototype, "orgId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], OrgFocusPreference.prototype, "focuses", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrgFocusPreference.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrgFocusPreference.prototype, "updatedAt", void 0);
exports.OrgFocusPreference = OrgFocusPreference = __decorate([
    (0, typeorm_1.Entity)('org_focus_preferences'),
    (0, typeorm_1.Index)(['orgId'], { unique: true })
], OrgFocusPreference);
//# sourceMappingURL=OrgFocusPreference.js.map