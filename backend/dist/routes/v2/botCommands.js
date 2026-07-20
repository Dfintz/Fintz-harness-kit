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
exports.router = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const express_1 = require("express");
const commandDocGenerator_1 = require("../../bot/utils/commandDocGenerator");
const rateLimiting_1 = require("../../middleware/rateLimiting");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const SKIP_FILES = new Set(['index', 'types', 'adminParent', 'orgParent']);
function loadCommandsFromDisk() {
    const commandsDir = path.resolve(__dirname, '../../bot/commands');
    const loaded = [];
    let files;
    try {
        files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    }
    catch {
        logger_1.logger.warn('Could not read bot commands directory', { commandsDir });
        return [];
    }
    for (const file of files) {
        const baseName = path.basename(file, path.extname(file));
        if (SKIP_FILES.has(baseName) || baseName.startsWith('__')) {
            continue;
        }
        loadCommandFromFile(path.join(commandsDir, file), baseName, loaded);
    }
    logger_1.logger.info(`Loaded ${loaded.length} bot commands for documentation`);
    return loaded;
}
let cachedCommandsList = loadCommandsFromDisk();
function getCommandsList() {
    if (cachedCommandsList.length > 0) {
        return cachedCommandsList;
    }
    cachedCommandsList = loadCommandsFromDisk();
    return cachedCommandsList;
}
function loadCommandFromFile(filePath, baseName, target) {
    try {
        const mod = require(filePath);
        for (const exp of Object.values(mod)) {
            if (exp !== null &&
                exp !== undefined &&
                typeof exp === 'object' &&
                'data' in exp &&
                'execute' in exp) {
                target.push(exp);
            }
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.debug(`Skipping bot command file ${baseName}: ${message}`);
    }
}
router.get('/commands', rateLimiting_1.publicEndpointRateLimiter, (req, res) => {
    const docs = (0, commandDocGenerator_1.generateCommandDocs)(getCommandsList());
    const category = req.query.category;
    const filtered = category ? docs.filter(d => d.category === category) : docs;
    const categories = [...new Set(docs.map(d => d.category))].sort((a, b) => a.localeCompare(b));
    res.json({
        data: filtered,
        meta: {
            total: filtered.length,
            categories,
        },
    });
});
//# sourceMappingURL=botCommands.js.map