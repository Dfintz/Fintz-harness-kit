"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const YAML = __importStar(require("js-yaml"));
const logger_1 = require("../utils/logger");
const bundledPath = path.join(__dirname, '../../openapi/api-bundled.yaml');
let swaggerSpec;
try {
    const fileContents = fs.readFileSync(bundledPath, 'utf8');
    exports.swaggerSpec = swaggerSpec = YAML.load(fileContents);
    if (swaggerSpec.openapi === '3.1.0') {
        swaggerSpec.openapi = '3.0.3';
    }
    logger_1.logger.info('OpenAPI specification loaded successfully from bundled spec');
}
catch (error) {
    logger_1.logger.error('Error loading OpenAPI spec:', error);
    exports.swaggerSpec = swaggerSpec = {
        openapi: '3.0.3',
        info: {
            title: 'Star Citizen Fleet Manager API',
            version: '2.0.0',
            description: 'API temporarily unavailable - spec loading error',
        },
        paths: {},
        components: {
            schemas: {},
        },
    };
}
//# sourceMappingURL=swagger.js.map