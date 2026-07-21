import express, { Request, Response, Router } from 'express';

import { discordWebhookVerification } from '../middleware/discordWebhookVerification';
import { DiscordWebhookEventService } from '../services/discord/DiscordWebhookEventService';
import { logger } from '../utils/logger';

/**
 * Discord Webhook Event Routes
 *
 * Single POST endpoint that receives incoming Discord webhook events.
 * Authentication is handled by Ed25519 signature verification — no JWT required.
 *
 * Must be mounted with express.raw() to preserve the raw body for signature
 * verification. The middleware parses the JSON body after verification and
 * replaces req.body with the parsed object.
 */
const router = Router();

// Use express.raw() to get the raw Buffer body for Ed25519 verification.
// The discordWebhookVerification middleware handles JSON parsing after signature check.
router.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  discordWebhookVerification(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const service = DiscordWebhookEventService.getInstance();
      await service.handleEvent(req.body);
    } catch (error) {
      // Log but still return 204 — Discord retries on non-2xx responses,
      // and we don't want transient errors to cause a retry storm.
      logger.error('Error processing Discord webhook event', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Always return 204 for valid (signature-verified) events.
    // Discord expects a 204 response within 3 seconds.
    res.status(204).end();
  }
);

/**
 * Mount Discord webhook event routes on an Express app.
 * Must be called BEFORE the global json() body parser in app.ts
 * so that express.raw() in the router can capture the raw body.
 */
export function setDiscordWebhookEventRoutes(app: express.Application): void {
  app.use('/api/v2/discord/webhook-events', router);
  logger.info('Discord webhook event endpoint registered at /api/v2/discord/webhook-events');
}
