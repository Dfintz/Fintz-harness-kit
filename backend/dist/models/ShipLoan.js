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
exports.ShipLoan = exports.LoanStatus = void 0;
const typeorm_1 = require("typeorm");
var LoanStatus;
(function (LoanStatus) {
    LoanStatus["PENDING"] = "pending";
    LoanStatus["APPROVED"] = "approved";
    LoanStatus["ACTIVE"] = "active";
    LoanStatus["RETURNED"] = "returned";
    LoanStatus["DECLINED"] = "declined";
    LoanStatus["OVERDUE"] = "overdue";
})(LoanStatus || (exports.LoanStatus = LoanStatus = {}));
let ShipLoan = class ShipLoan {
    id;
    shipId;
    shipName;
    lenderId;
    borrowerId;
    organizationId;
    activityId;
    activityName;
    scope;
    purpose;
    requestDate;
    approvedDate;
    startDate;
    expectedReturnDate;
    actualReturnDate;
    status;
    terms;
    notes;
    insuranceRequired;
    createdAt;
    updatedAt;
};
exports.ShipLoan = ShipLoan;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ShipLoan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipLoan.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "shipName", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipLoan.prototype, "lenderId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipLoan.prototype, "borrowerId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "activityName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "purpose", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], ShipLoan.prototype, "requestDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ShipLoan.prototype, "approvedDate", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], ShipLoan.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Date)
], ShipLoan.prototype, "expectedReturnDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], ShipLoan.prototype, "actualReturnDate", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: LoanStatus.PENDING,
    }),
    __metadata("design:type", String)
], ShipLoan.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "terms", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipLoan.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ShipLoan.prototype, "insuranceRequired", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ShipLoan.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ShipLoan.prototype, "updatedAt", void 0);
exports.ShipLoan = ShipLoan = __decorate([
    (0, typeorm_1.Entity)('ship_loans')
], ShipLoan);
//# sourceMappingURL=ShipLoan.js.map