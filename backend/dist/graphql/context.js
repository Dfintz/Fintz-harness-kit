"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tsyringe_1 = require("tsyringe");
const logger_1 = require("../utils/logger");
const DataLoaderFactory_1 = require("../utils/query/DataLoaderFactory");
const dataloaders_1 = require("./dataloaders");
function getUserFromRequest(req) {
    if (!req) {
        return null;
    }
    const user = req.user;
    if (user) {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            organizationIds: user.organizationIds,
        };
    }
    return null;
}
function getUserFromToken(token) {
    if (!token) {
        return null;
    }
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            if (process.env.NODE_ENV === 'production') {
                logger_1.logger.error('JWT_SECRET is required in production environment');
                return null;
            }
            logger_1.logger.warn('JWT_SECRET not set - token verification disabled in development');
            return null;
        }
        const decoded = jsonwebtoken_1.default.verify(cleanToken, jwtSecret, { algorithms: ['HS256'] });
        return {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email,
            organizationIds: decoded.organizationIds,
        };
    }
    catch {
        return null;
    }
}
function createLoaders() {
    return (0, dataloaders_1.createDataLoaders)();
}
function createContext(options) {
    const { req, res, token } = options;
    const user = req ? getUserFromRequest(req) : getUserFromToken(token);
    return {
        user,
        req,
        res,
        container: tsyringe_1.container,
        loaders: createLoaders(),
        tenantLoaders: new DataLoaderFactory_1.DataLoaderContext(),
    };
}
//# sourceMappingURL=context.js.map