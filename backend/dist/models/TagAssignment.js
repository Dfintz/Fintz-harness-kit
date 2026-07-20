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
exports.TagAssignment = void 0;
const typeorm_1 = require("typeorm");
const Tag_1 = require("./Tag");
let TagAssignment = class TagAssignment {
    id;
    tagId;
    tag;
    resourceType;
    resourceId;
    assignedBy;
    createdAt;
};
exports.TagAssignment = TagAssignment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TagAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], TagAssignment.prototype, "tagId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Tag_1.Tag, t => t.assignments, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'tagId' }),
    __metadata("design:type", Tag_1.Tag)
], TagAssignment.prototype, "tag", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], TagAssignment.prototype, "resourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], TagAssignment.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], TagAssignment.prototype, "assignedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TagAssignment.prototype, "createdAt", void 0);
exports.TagAssignment = TagAssignment = __decorate([
    (0, typeorm_1.Entity)('tag_assignments'),
    (0, typeorm_1.Index)(['tagId', 'resourceType', 'resourceId'], { unique: true }),
    (0, typeorm_1.Index)(['resourceType', 'resourceId']),
    (0, typeorm_1.Index)(['tagId'])
], TagAssignment);
//# sourceMappingURL=TagAssignment.js.map