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
exports.ExampleController = void 0;
const tsyringe_1 = require("tsyringe");
const routing_1 = require("../routing");
const logger_1 = require("../utils/logger");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
const logRequest = (req, res, next) => {
    logger_1.logger.debug(`Request: ${req.method} ${req.path}`);
    next();
};
let ExampleController = class ExampleController extends BaseController_1.BaseController {
    async list(req, res) {
        await this.executeAndReturn(req, res, async () => ({
            message: 'List of examples',
            data: [],
            meta: {
                page: 1,
                limit: 10,
                total: 0,
            },
        }));
    }
    async getById(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            return {
                message: `Get example ${id}`,
                data: { id },
            };
        });
    }
    async create(req, res) {
        await this.executeAndReturn(req, res, async () => ({
            message: 'Example created',
            data: req.body,
        }), 201);
    }
    async update(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            return {
                message: `Example ${id} updated`,
                data: { id, ...(0, prototypePollutionPrevention_1.sanitizeObject)(req.body) },
            };
        });
    }
    async delete(req, res) {
        await this.executeAndReturn(req, res, async () => null, 204);
    }
};
exports.ExampleController = ExampleController;
__decorate([
    (0, routing_1.Get)('/'),
    (0, routing_1.UseMiddleware)(logRequest),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExampleController.prototype, "list", null);
__decorate([
    (0, routing_1.Get)('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExampleController.prototype, "getById", null);
__decorate([
    (0, routing_1.Post)('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExampleController.prototype, "create", null);
__decorate([
    (0, routing_1.Put)('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExampleController.prototype, "update", null);
__decorate([
    (0, routing_1.Delete)('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ExampleController.prototype, "delete", null);
exports.ExampleController = ExampleController = __decorate([
    (0, tsyringe_1.injectable)(),
    (0, routing_1.Controller)('/examples')
], ExampleController);
//# sourceMappingURL=ExampleController.js.map