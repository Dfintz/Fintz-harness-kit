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
exports.WorkflowDefinition = exports.WorkflowStatus = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const WorkflowExecution_1 = require("./WorkflowExecution");
var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["ACTIVE"] = "active";
    WorkflowStatus["INACTIVE"] = "inactive";
    WorkflowStatus["ARCHIVED"] = "archived";
})(WorkflowStatus || (exports.WorkflowStatus = WorkflowStatus = {}));
let WorkflowDefinition = class WorkflowDefinition {
    id;
    organizationId;
    organization;
    name;
    type;
    description;
    trigger;
    actions;
    enabled;
    status;
    createdBy;
    executions;
    createdAt;
    updatedAt;
};
exports.WorkflowDefinition = WorkflowDefinition;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], WorkflowDefinition.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], WorkflowDefinition.prototype, "trigger", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], WorkflowDefinition.prototype, "actions", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], WorkflowDefinition.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: WorkflowStatus.ACTIVE }),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowDefinition.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => WorkflowExecution_1.WorkflowExecution, execution => execution.workflow),
    __metadata("design:type", Array)
], WorkflowDefinition.prototype, "executions", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], WorkflowDefinition.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], WorkflowDefinition.prototype, "updatedAt", void 0);
exports.WorkflowDefinition = WorkflowDefinition = __decorate([
    (0, typeorm_1.Entity)('workflow_definitions')
], WorkflowDefinition);
//# sourceMappingURL=WorkflowDefinition.js.map