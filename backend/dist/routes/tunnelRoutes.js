"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const TunnelService_1 = require("../services/discord/TunnelService");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const tunnelService = TunnelService_1.TunnelService.getInstance();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const tunnels = await tunnelService.listPublicTunnels();
        return res.json({
            success: true,
            data: tunnels,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching tunnels:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tunnels',
        });
    }
});
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tunnel = await tunnelService.getTunnel(id);
        if (!tunnel) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        return res.json({
            success: true,
            data: tunnel,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching tunnel:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tunnel',
        });
    }
});
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { name, isPublic, password, rateLimitConfig } = req.body;
        const userId = req.user?.id;
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Tunnel name is required',
            });
        }
        const guildId = `user-${userId}`;
        const channelId = `channel-${userId}-${Date.now()}`;
        const tunnel = await tunnelService.createTunnel(name, guildId, channelId, isPublic !== false, password, { rateLimitConfig });
        return res.status(201).json({
            success: true,
            data: tunnel,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating tunnel:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create tunnel',
        });
    }
});
router.post('/:id/connect', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const userId = req.user?.id;
        const guildId = `user-${userId}`;
        const channelId = `channel-${userId}-${Date.now()}`;
        const result = await tunnelService.connectToTunnel(id, guildId, channelId, password);
        return res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('Error connecting to tunnel:', error);
        return res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to connect to tunnel',
        });
    }
});
router.post('/:id/disconnect', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const guildId = `user-${userId}`;
        const tunnel = await tunnelService.getTunnel(id);
        if (!tunnel) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        const connection = tunnel.connectedChannels.find(c => c.guildId === guildId);
        if (!connection) {
            return res.status(400).json({
                success: false,
                error: 'Not connected to this tunnel',
            });
        }
        await tunnelService.disconnectFromTunnel(id, guildId, connection.channelId);
        return res.json({
            success: true,
            message: 'Disconnected from tunnel',
        });
    }
    catch (error) {
        logger_1.logger.error('Error disconnecting from tunnel:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to disconnect from tunnel',
        });
    }
});
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const guildId = `user-${userId}`;
        const tunnel = await tunnelService.getTunnel(id);
        if (!tunnel) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        if (tunnel.creatorGuildId !== guildId) {
            return res.status(403).json({
                success: false,
                error: 'Only the tunnel creator can delete it',
            });
        }
        await tunnelService.deleteTunnel(id, guildId);
        return res.json({
            success: true,
            message: 'Tunnel deleted successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error deleting tunnel:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete tunnel',
        });
    }
});
router.put('/:id/rate-limit', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { maxMessages, windowMs, blockDurationMs } = req.body;
        const userId = req.user?.id;
        const guildId = `user-${userId}`;
        const tunnel = await tunnelService.getTunnel(id);
        if (!tunnel) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        if (tunnel.creatorGuildId !== guildId) {
            return res.status(403).json({
                success: false,
                error: 'Only the tunnel creator can update settings',
            });
        }
        const success = await tunnelService.updateRateLimitConfig(id, {
            maxMessages,
            windowMs,
            blockDurationMs,
        });
        if (!success) {
            return res.status(400).json({
                success: false,
                error: 'Failed to update rate limit configuration',
            });
        }
        return res.json({
            success: true,
            message: 'Rate limit configuration updated',
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating rate limit:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update rate limit',
        });
    }
});
router.put('/:id/content-filter', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        const userId = req.user?.id;
        const guildId = `user-${userId}`;
        const tunnel = await tunnelService.getTunnel(id);
        if (!tunnel) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        if (tunnel.creatorGuildId !== guildId) {
            return res.status(403).json({
                success: false,
                error: 'Only the tunnel creator can update settings',
            });
        }
        const success = await tunnelService.toggleContentFilter(id, enabled);
        if (!success) {
            return res.status(400).json({
                success: false,
                error: 'Failed to toggle content filter',
            });
        }
        return res.json({
            success: true,
            message: `Content filter ${enabled ? 'enabled' : 'disabled'}`,
        });
    }
    catch (error) {
        logger_1.logger.error('Error toggling content filter:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to toggle content filter',
        });
    }
});
router.get('/:id/config', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const config = tunnelService.getTunnelConfig(id);
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        return res.json({
            success: true,
            data: config,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching tunnel config:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tunnel configuration',
        });
    }
});
router.get('/:id/analytics', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tunnel = await tunnelService.getTunnel(id);
        if (!tunnel) {
            return res.status(404).json({
                success: false,
                error: 'Tunnel not found',
            });
        }
        const analytics = tunnelService.getTunnelAnalytics(id);
        if (!analytics) {
            return res.json({
                success: true,
                data: {
                    tunnelId: id,
                    messagesRelayed: 0,
                    messagesBlocked: 0,
                    lastActivity: null,
                    peakConnectionCount: 0,
                    totalUniqueGuilds: 0,
                },
            });
        }
        return res.json({
            success: true,
            data: analytics,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching tunnel analytics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tunnel analytics',
        });
    }
});
router.get('/stats/system', auth_1.authenticateToken, async (req, res) => {
    try {
        const stats = tunnelService.getSystemStats();
        return res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching system stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch system statistics',
        });
    }
});
router.get('/stats/hourly', auth_1.authenticateToken, async (req, res) => {
    try {
        const hourlyActivity = tunnelService.getHourlyActivity();
        const hourlyData = Array.from(hourlyActivity.entries()).map(([hour, count]) => ({
            hour,
            count,
        }));
        return res.json({
            success: true,
            data: hourlyData,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching hourly activity:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch hourly activity',
        });
    }
});
router.post('/analytics/reset', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Admin access required',
            });
        }
        tunnelService.resetAnalytics();
        return res.json({
            success: true,
            message: 'Analytics data reset successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Error resetting analytics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to reset analytics',
        });
    }
});
//# sourceMappingURL=tunnelRoutes.js.map