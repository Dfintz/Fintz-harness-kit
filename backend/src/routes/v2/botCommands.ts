import * as fs from 'node:fs';
import * as path from 'node:path';

import { Request, Response, Router } from 'express';

import { BotCommand } from '../../bot/commands/types';
import { generateCommandDocs } from '../../bot/utils/commandDocGenerator';
import { publicEndpointRateLimiter } from '../../middleware/rateLimiting';
import { logger } from '../../utils/logger';

const router = Router();

// Command files to skip (non-command modules and legacy parent wrappers)
const SKIP_FILES = new Set(['index', 'types', 'adminParent', 'orgParent']);

/** Scan the bot commands directory and load each file individually */
function loadCommandsFromDisk(): BotCommand[] {
  const commandsDir = path.resolve(__dirname, '../../bot/commands');
  const loaded: BotCommand[] = [];

  let files: string[];
  try {
    files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  } catch {
    logger.warn('Could not read bot commands directory', { commandsDir });
    return [];
  }

  for (const file of files) {
    const baseName = path.basename(file, path.extname(file));
    if (SKIP_FILES.has(baseName) || baseName.startsWith('__')) {
      continue;
    }
    loadCommandFromFile(path.join(commandsDir, file), baseName, loaded);
  }

  logger.info(`Loaded ${loaded.length} bot commands for documentation`);
  return loaded;
}

// Load command metadata at startup for fast responses.
let cachedCommandsList: BotCommand[] = loadCommandsFromDisk();

function getCommandsList(): BotCommand[] {
  if (cachedCommandsList.length > 0) {
    return cachedCommandsList;
  }

  // Fallback: retry loading if startup happened before command dependencies were ready.
  cachedCommandsList = loadCommandsFromDisk();
  return cachedCommandsList;
}

/** Try to load BotCommand exports from a single file */
function loadCommandFromFile(filePath: string, baseName: string, target: BotCommand[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(filePath);
    for (const exp of Object.values(mod)) {
      if (
        exp !== null &&
        exp !== undefined &&
        typeof exp === 'object' &&
        'data' in exp &&
        'execute' in exp
      ) {
        target.push(exp as BotCommand);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.debug(`Skipping bot command file ${baseName}: ${message}`);
  }
}

/**
 * GET /api/v2/bot/commands
 * Returns documentation for all Discord bot commands.
 * Public endpoint — no authentication required.
 */
// deepcode ignore NoRateLimitingForExpensiveWebOperation: rate limiting IS applied
// via publicEndpointRateLimiter middleware (see middleware/rateLimiting.ts).
router.get('/commands', publicEndpointRateLimiter, (req: Request, res: Response) => {
  const docs = generateCommandDocs(getCommandsList());

  // Optional category filter
  const category = req.query.category as string | undefined;
  const filtered = category ? docs.filter(d => d.category === category) : docs;

  // Collect unique categories for filtering UI
  const categories = [...new Set(docs.map(d => d.category))].sort((a, b) => a.localeCompare(b));

  res.json({
    data: filtered,
    meta: {
      total: filtered.length,
      categories,
    },
  });
});

export { router };
