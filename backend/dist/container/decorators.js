"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoInjectable = exports.singleton = exports.inject = exports.injectable = void 0;
exports.Service = Service;
exports.TransientService = TransientService;
var tsyringe_1 = require("tsyringe");
Object.defineProperty(exports, "injectable", { enumerable: true, get: function () { return tsyringe_1.injectable; } });
Object.defineProperty(exports, "inject", { enumerable: true, get: function () { return tsyringe_1.inject; } });
Object.defineProperty(exports, "singleton", { enumerable: true, get: function () { return tsyringe_1.singleton; } });
Object.defineProperty(exports, "autoInjectable", { enumerable: true, get: function () { return tsyringe_1.autoInjectable; } });
const tsyringe_2 = require("tsyringe");
function Service() {
    return function (target) {
        (0, tsyringe_2.singleton)()(target);
        (0, tsyringe_2.injectable)()(target);
    };
}
function TransientService() {
    return function (target) {
        (0, tsyringe_2.injectable)()(target);
    };
}
//# sourceMappingURL=decorators.js.map