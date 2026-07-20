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
exports.setDiscordWebhookEventRoutes = setDiscordWebhookEventRoutes;
const express_1 = __importStar(require("express"));
const discordWebhookVerification_1 = require("../middleware/discordWebhookVerification");
const DiscordWebhookEventService_1 = require("../services/discord/DiscordWebhookEventService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.post('/', express_1.default.raw({ type: 'application/json', limit: '1mb' }), (0, discordWebhookVerification_1.discordWebhookVerification)(), async (req, res) => {
    try {
        const service = DiscordWebhookEventService_1.DiscordWebhookEventService.getInstance();
        await service.handleEvent(req.body);
    }
    catch (error) {
        logger_1.logger.error('Error processing Discord webhook event', {
            error: error instanceof Error ? error.message : String(error),
        });
    }
    res.status(204).end();
});
function setDiscordWebhookEventRoutes(app) {
    app.use('/api/v2/discord/webhook-events', router);
    logger_1.logger.info('Discord webhook event endpoint registered at /api/v2/discord/webhook-events');
}
//# sourceMappingURL=discordWebhookEventRoutes.js.map