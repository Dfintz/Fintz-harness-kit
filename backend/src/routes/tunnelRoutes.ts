import { Response, Router } from 'express';

import { authenticateToken, AuthRequest } from '../middleware/auth';
import { TunnelService } from '../services/discord/TunnelService';
import { logger } from '../utils/logger';

const router = Router();
const tunnelService = TunnelService.getInstance();

/**
 * Get all public tunnels
 * GET /api/tunnels
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tunnels = await tunnelService.listPublicTunnels();
    return res.json({
      success: true,
      data: tunnels,
    });
  } catch (error: unknown) {
    logger.error('Error fetching tunnels:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tunnels',
    });
  }
});

/**
 * Get tunnel by ID
 * GET /api/tunnels/:id
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
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
  } catch (error: unknown) {
    logger.error('Error fetching tunnel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tunnel',
    });
  }
});

/**
 * Create a new tunnel
 * POST /api/tunnels
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { name, isPublic, password, rateLimitConfig } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Tunnel name is required',
      });
    }

    // For web interface, we use userId as guildId and create a virtual channel
    const guildId = `user-${userId}`;
    const channelId = `channel-${userId}-${Date.now()}`;

    const tunnel = await tunnelService.createTunnel(
      name,
      guildId,
      channelId,
      isPublic !== false, // Default to public
      password,
      { rateLimitConfig }
    );

    return res.status(201).json({
      success: true,
      data: tunnel,
    });
  } catch (error: unknown) {
    logger.error('Error creating tunnel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create tunnel',
    });
  }
});

/**
 * Connect to a tunnel
 * POST /api/tunnels/:id/connect
 */
router.post('/:id/connect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;

    const guildId = `user-${userId}`;
    const channelId = `channel-${userId}-${Date.now()}`;

    const result = await tunnelService.connectToTunnel(id, guildId, channelId, password);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Error connecting to tunnel:', error);
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to tunnel',
    });
  }
});

/**
 * Disconnect from a tunnel
 * POST /api/tunnels/:id/disconnect
 */
router.post('/:id/disconnect', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    const guildId = `user-${userId}`;

    // Find the channel ID for this user
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
  } catch (error: unknown) {
    logger.error('Error disconnecting from tunnel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to disconnect from tunnel',
    });
  }
});

/**
 * Delete a tunnel (only creator can delete)
 * DELETE /api/tunnels/:id
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    const guildId = `user-${userId}`;

    const tunnel = await tunnelService.getTunnel(id);
    if (!tunnel) {
      return res.status(404).json({
        success: false,
        error: 'Tunnel not found',
      });
    }

    // Check if user is the creator
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
  } catch (error: unknown) {
    logger.error('Error deleting tunnel:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete tunnel',
    });
  }
});

/**
 * Update tunnel rate limit configuration
 * PUT /api/tunnels/:id/rate-limit
 */
router.put('/:id/rate-limit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { maxMessages, windowMs, blockDurationMs } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    const guildId = `user-${userId}`;

    const tunnel = await tunnelService.getTunnel(id);
    if (!tunnel) {
      return res.status(404).json({
        success: false,
        error: 'Tunnel not found',
      });
    }

    // Check if user is the creator
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
  } catch (error: unknown) {
    logger.error('Error updating rate limit:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update rate limit',
    });
  }
});

/**
 * Toggle content filter
 * PUT /api/tunnels/:id/content-filter
 */
router.put('/:id/content-filter', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    const guildId = `user-${userId}`;

    const tunnel = await tunnelService.getTunnel(id);
    if (!tunnel) {
      return res.status(404).json({
        success: false,
        error: 'Tunnel not found',
      });
    }

    // Check if user is the creator
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
  } catch (error: unknown) {
    logger.error('Error toggling content filter:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle content filter',
    });
  }
});

/**
 * Get tunnel configuration
 * GET /api/tunnels/:id/config
 */
router.get('/:id/config', authenticateToken, async (req: AuthRequest, res: Response) => {
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
  } catch (error: unknown) {
    logger.error('Error fetching tunnel config:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tunnel configuration',
    });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

/**
 * Get analytics for a specific tunnel
 * GET /api/tunnels/:id/analytics
 */
router.get('/:id/analytics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify tunnel exists
    const tunnel = await tunnelService.getTunnel(id);
    if (!tunnel) {
      return res.status(404).json({
        success: false,
        error: 'Tunnel not found',
      });
    }

    const analytics = tunnelService.getTunnelAnalytics(id);

    if (!analytics) {
      // Return empty analytics if no data recorded yet
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
  } catch (error: unknown) {
    logger.error('Error fetching tunnel analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tunnel analytics',
    });
  }
});

/**
 * Get system-wide tunnel statistics
 * GET /api/tunnels/stats/system
 */
router.get('/stats/system', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const stats = tunnelService.getSystemStats();

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    logger.error('Error fetching system stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics',
    });
  }
});

/**
 * Get hourly activity data
 * GET /api/tunnels/stats/hourly
 */
router.get('/stats/hourly', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const hourlyActivity = tunnelService.getHourlyActivity();

    // Convert Map to array for JSON serialization
    const hourlyData = Array.from(hourlyActivity.entries()).map(([hour, count]) => ({
      hour,
      count,
    }));

    return res.json({
      success: true,
      data: hourlyData,
    });
  } catch (error: unknown) {
    logger.error('Error fetching hourly activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch hourly activity',
    });
  }
});

/**
 * Reset analytics (admin only)
 * POST /api/tunnels/analytics/reset
 */
router.post('/analytics/reset', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Require admin privileges for resetting analytics
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
  } catch (error: unknown) {
    logger.error('Error resetting analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset analytics',
    });
  }
});

export { router };
