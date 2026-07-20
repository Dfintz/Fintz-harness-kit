"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerControllers = registerControllers;
exports.getControllerRoutes = getControllerRoutes;
exports.getControllerBasePath = getControllerBasePath;
const tsyringe_1 = require("tsyringe");
const logger_1 = require("../utils/logger");
const decorators_1 = require("./decorators");
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
function registerController(app, ControllerClass, options = {}) {
    const { prefix = '', globalMiddleware = [], debug = false } = options;
    const registeredRoutes = [];
    const basePath = Reflect.getMetadata(decorators_1.CONTROLLER_KEY, ControllerClass) || '';
    const routes = Reflect.getMetadata(decorators_1.ROUTES_KEY, ControllerClass) || [];
    if (routes.length === 0) {
        logger_1.logger.warn(`Controller ${ControllerClass.name} has no routes defined`);
        return registeredRoutes;
    }
    let controllerInstance;
    try {
        controllerInstance = tsyringe_1.container.resolve(ControllerClass);
    }
    catch (_error) {
        controllerInstance = new ControllerClass();
    }
    for (const route of routes) {
        const fullPath = `${prefix}${basePath}${route.path}`;
        const handler = controllerInstance[route.handlerName].bind(controllerInstance);
        const middleware = [
            ...globalMiddleware,
            ...route.middleware,
        ];
        const expressMethod = app[route.method].bind(app);
        expressMethod(fullPath, ...middleware, asyncHandler(handler));
        registeredRoutes.push({
            method: route.method.toUpperCase(),
            path: fullPath,
            controller: ControllerClass.name,
            handler: route.handlerName,
        });
        if (debug) {
            logger_1.logger.debug(`Registered route: ${route.method.toUpperCase()} ${fullPath} -> ${ControllerClass.name}.${route.handlerName}`);
        }
    }
    return registeredRoutes;
}
function registerControllers(app, controllers, options = {}) {
    const allRoutes = [];
    for (const controller of controllers) {
        const routes = registerController(app, controller, options);
        allRoutes.push(...routes);
    }
    logger_1.logger.info(`Registered ${allRoutes.length} routes from ${controllers.length} controllers`);
    return allRoutes;
}
function getControllerRoutes(ControllerClass) {
    return Reflect.getMetadata(decorators_1.ROUTES_KEY, ControllerClass) || [];
}
function getControllerBasePath(ControllerClass) {
    return Reflect.getMetadata(decorators_1.CONTROLLER_KEY, ControllerClass) || '';
}
//# sourceMappingURL=register.js.map