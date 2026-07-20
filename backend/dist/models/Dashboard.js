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
exports.Dashboard = exports.DashboardLayout = exports.DashboardType = void 0;
const typeorm_1 = require("typeorm");
const DashboardWidget_1 = require("./DashboardWidget");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var DashboardType;
(function (DashboardType) {
    DashboardType["CUSTOM"] = "custom";
    DashboardType["FLEET"] = "fleet";
    DashboardType["ANALYTICS"] = "analytics";
    DashboardType["OPERATIONS"] = "operations";
})(DashboardType || (exports.DashboardType = DashboardType = {}));
var DashboardLayout;
(function (DashboardLayout) {
    DashboardLayout["GRID"] = "grid";
    DashboardLayout["LIST"] = "list";
    DashboardLayout["FREEFORM"] = "freeform";
})(DashboardLayout || (exports.DashboardLayout = DashboardLayout = {}));
let Dashboard = class Dashboard {
    id;
    organizationId;
    organization;
    name;
    description;
    type;
    layout;
    createdBy;
    creator;
    isDefault;
    sharedWithUsers;
    widgets;
    createdAt;
    updatedAt;
};
exports.Dashboard = Dashboard;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Dashboard.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Dashboard.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], Dashboard.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Dashboard.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Dashboard.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: DashboardType.CUSTOM }),
    __metadata("design:type", String)
], Dashboard.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: DashboardLayout.GRID }),
    __metadata("design:type", String)
], Dashboard.prototype, "layout", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Dashboard.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'createdBy' }),
    __metadata("design:type", User_1.User)
], Dashboard.prototype, "creator", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Dashboard.prototype, "isDefault", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true, default: '' }),
    __metadata("design:type", Array)
], Dashboard.prototype, "sharedWithUsers", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DashboardWidget_1.DashboardWidget, widget => widget.dashboard, { cascade: true, eager: true }),
    __metadata("design:type", Array)
], Dashboard.prototype, "widgets", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Dashboard.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Dashboard.prototype, "updatedAt", void 0);
exports.Dashboard = Dashboard = __decorate([
    (0, typeorm_1.Entity)('dashboards')
], Dashboard);
//# sourceMappingURL=Dashboard.js.map