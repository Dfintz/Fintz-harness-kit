"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Delete = exports.Patch = exports.Put = exports.Post = exports.Get = exports.MIDDLEWARE_KEY = exports.ROUTES_KEY = exports.CONTROLLER_KEY = void 0;
exports.Controller = Controller;
exports.UseMiddleware = UseMiddleware;
exports.UseControllerMiddleware = UseControllerMiddleware;
exports.Authenticate = Authenticate;
exports.ValidateBody = ValidateBody;
exports.ValidateQuery = ValidateQuery;
exports.ValidateParams = ValidateParams;
require("reflect-metadata");
exports.CONTROLLER_KEY = 'controller:path';
exports.ROUTES_KEY = 'controller:routes';
exports.MIDDLEWARE_KEY = 'route:middleware';
function Controller(basePath = '') {
    return function (target) {
        Reflect.defineMetadata(exports.CONTROLLER_KEY, basePath, target);
        if (!Reflect.hasMetadata(exports.ROUTES_KEY, target)) {
            Reflect.defineMetadata(exports.ROUTES_KEY, [], target);
        }
    };
}
function createRouteDecorator(method) {
    return function (path = '') {
        return function (target, propertyKey, descriptor) {
            const controllerClass = target.constructor;
            const routes = Reflect.getMetadata(exports.ROUTES_KEY, controllerClass) || [];
            const middleware = Reflect.getMetadata(exports.MIDDLEWARE_KEY, target, propertyKey) || [];
            routes.push({
                method,
                path,
                handlerName: propertyKey,
                middleware,
            });
            Reflect.defineMetadata(exports.ROUTES_KEY, routes, controllerClass);
            return descriptor;
        };
    };
}
exports.Get = createRouteDecorator('get');
exports.Post = createRouteDecorator('post');
exports.Put = createRouteDecorator('put');
exports.Patch = createRouteDecorator('patch');
exports.Delete = createRouteDecorator('delete');
function UseMiddleware(...middleware) {
    return function (target, propertyKey, descriptor) {
        const existingMiddleware = Reflect.getMetadata(exports.MIDDLEWARE_KEY, target, propertyKey) || [];
        Reflect.defineMetadata(exports.MIDDLEWARE_KEY, [...existingMiddleware, ...middleware], target, propertyKey);
        return descriptor;
    };
}
function UseControllerMiddleware(...middleware) {
    return function (target) {
        const routes = Reflect.getMetadata(exports.ROUTES_KEY, target) || [];
        routes.forEach(route => {
            route.middleware = [...middleware, ...route.middleware];
        });
        Reflect.defineMetadata(exports.ROUTES_KEY, routes, target);
    };
}
function Authenticate() {
    return function (target, propertyKey, descriptor) {
        const { authenticateToken } = require('../middleware/auth');
        return UseMiddleware(authenticateToken)(target, propertyKey, descriptor);
    };
}
function ValidateBody(schema) {
    return function (target, propertyKey, descriptor) {
        const { validateSchema } = require('../middleware/schemaValidation');
        return UseMiddleware(validateSchema(schema, 'body'))(target, propertyKey, descriptor);
    };
}
function ValidateQuery(schema) {
    return function (target, propertyKey, descriptor) {
        const { validateSchema } = require('../middleware/schemaValidation');
        return UseMiddleware(validateSchema(schema, 'query'))(target, propertyKey, descriptor);
    };
}
function ValidateParams(schema) {
    return function (target, propertyKey, descriptor) {
        const { validateSchema } = require('../middleware/schemaValidation');
        return UseMiddleware(validateSchema(schema, 'params'))(target, propertyKey, descriptor);
    };
}
//# sourceMappingURL=decorators.js.map