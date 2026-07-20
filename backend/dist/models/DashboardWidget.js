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
exports.DashboardWidget = void 0;
const typeorm_1 = require("typeorm");
const Dashboard_1 = require("./Dashboard");
let DashboardWidget = class DashboardWidget {
    id;
    dashboardId;
    dashboard;
    type;
    title;
    config;
    position;
    sortOrder;
    createdAt;
    updatedAt;
};
exports.DashboardWidget = DashboardWidget;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DashboardWidget.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], DashboardWidget.prototype, "dashboardId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Dashboard_1.Dashboard, dashboard => dashboard.widgets, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'dashboardId' }),
    __metadata("design:type", Dashboard_1.Dashboard)
], DashboardWidget.prototype, "dashboard", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], DashboardWidget.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], DashboardWidget.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], DashboardWidget.prototype, "config", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], DashboardWidget.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], DashboardWidget.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DashboardWidget.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DashboardWidget.prototype, "updatedAt", void 0);
exports.DashboardWidget = DashboardWidget = __decorate([
    (0, typeorm_1.Entity)('dashboard_widgets')
], DashboardWidget);
//# sourceMappingURL=DashboardWidget.js.map