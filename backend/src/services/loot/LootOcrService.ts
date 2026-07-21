import type {
  LootItemCategory,
  LootOcrResult,
  LootOcrSuggestion,
} from '@sc-fleet-manager/shared-types';

import { logger } from '../../utils/logger';

/**
 * LootOcrService
 *
 * Runs an uploaded inventory screenshot through Azure AI Vision (Image Analysis
 * 4.0 "read" feature) to extract candidate loot items, so the mission leader can
 * fill out a loot pool faster instead of typing every row by hand.
 *
 * Configuration (optional):
 *   AZURE_VISION_ENDPOINT  e.g. https://<resource>.cognitiveservices.azure.com
 *   AZURE_VISION_KEY       the resource key
 *
 * When unconfigured, the service degrades gracefully: { enabled: false } with no
 * suggestions, so the upload UI still works (the leader just types manually).
 */
export class LootOcrService {
  private static readonly PROVIDER = 'azure-vision';
  private static readonly API_VERSION = '2024-02-01';

  private get endpoint(): string | undefined {
    return process.env.AZURE_VISION_ENDPOINT?.replace(/\/+$/, '');
  }

  private get apiKey(): string | undefined {
    return process.env.AZURE_VISION_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  /**
   * Extract loot item suggestions from an image buffer.
   * Never throws on OCR failure — returns an empty, enabled:false result instead
   * so the caller can always fall back to manual entry.
   */
  async extractItems(imageBuffer: Buffer): Promise<LootOcrResult> {
    if (!this.isConfigured()) {
      logger.info('LootOcrService not configured — skipping OCR, manual entry only');
      return { suggestions: [], rawLines: [], provider: LootOcrService.PROVIDER, enabled: false };
    }

    try {
      const url =
        `${this.endpoint}/computervision/imageanalysis:analyze` +
        `?api-version=${LootOcrService.API_VERSION}&features=read`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey as string,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(imageBuffer),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        logger.warn('Azure Vision OCR request failed', {
          status: response.status,
          body: text.slice(0, 500),
        });
        return { suggestions: [], rawLines: [], provider: LootOcrService.PROVIDER, enabled: true };
      }

      const json = (await response.json()) as AzureVisionResponse;
      const rawLines = this.collectLines(json);
      const suggestions = this.parseLines(rawLines);

      logger.info('Loot OCR completed', {
        lines: rawLines.length,
        suggestions: suggestions.length,
      });
      return { suggestions, rawLines, provider: LootOcrService.PROVIDER, enabled: true };
    } catch (error: unknown) {
      logger.error('Loot OCR error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { suggestions: [], rawLines: [], provider: LootOcrService.PROVIDER, enabled: true };
    }
  }

  /** Flatten Azure's blocks -> lines into a list of text lines. */
  private collectLines(json: AzureVisionResponse): string[] {
    const blocks = json.readResult?.blocks ?? [];
    const lines: string[] = [];
    for (const block of blocks) {
      for (const line of block.lines ?? []) {
        const text = line.text?.trim();
        if (text) {
          lines.push(text);
        }
      }
    }
    return lines;
  }

  /**
   * Heuristically turn OCR text lines into { name, quantity } suggestions.
   * Recognises common quantity notations: "Medical Supplies x3", "3x Titanium",
   * "Titanium  12", and SCU counts. Lines that are obviously not items
   * (pure numbers, very short tokens) are skipped.
   */
  private parseLines(lines: string[]): LootOcrSuggestion[] {
    const suggestions: LootOcrSuggestion[] = [];

    for (const original of lines) {
      const line = original.replace(/\s+/g, ' ').trim();
      if (line.length < 3) {
        continue;
      }
      // Skip lines that are just a number / currency / header noise.
      if (/^[\d.,\s]+$/.test(line)) {
        continue;
      }

      let quantity = 1;
      let name = line;

      // "3x Name" or "x3 Name"
      const leading = name.match(/^x?(\d{1,4})\s*[x×]?\s+(.+)$/i);
      // "Name x3" or "Name ×3"
      const trailingX = name.match(/^(.+?)\s*[x×]\s*(\d{1,4})$/i);
      // "Name 12" (trailing count, possibly with unit like SCU)
      const trailingNum = name.match(/^(.+?)\s+(\d{1,4})(?:\s*(?:scu|units?|x))?$/i);

      if (leading && leading[2]) {
        quantity = Number.parseInt(leading[1], 10);
        name = leading[2];
      } else if (trailingX && trailingX[1]) {
        name = trailingX[1];
        quantity = Number.parseInt(trailingX[2], 10);
      } else if (trailingNum && trailingNum[1] && /[a-z]/i.test(trailingNum[1])) {
        name = trailingNum[1];
        quantity = Number.parseInt(trailingNum[2], 10);
      }

      name = name.replace(/[•·\-–|]+$/g, '').trim();
      if (name.length < 2) {
        continue;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        quantity = 1;
      }

      suggestions.push({
        name,
        quantity,
        category: this.guessCategory(name),
      });
    }

    return suggestions;
  }

  /** Best-effort category guess from the item name. */
  private guessCategory(name: string): LootItemCategory {
    const lower = name.toLowerCase();
    if (/(rifle|pistol|smg|shotgun|sniper|grenade|ammo|magazine)/.test(lower)) {
      return 'weapon';
    }
    if (/(armor|helmet|undersuit|backpack|gear|medpen|oxypen|suit)/.test(lower)) {
      return 'gear';
    }
    if (/(shield|cooler|power plant|quantum|thruster|component|weapon mount)/.test(lower)) {
      return 'component';
    }
    if (
      /(titanium|laranite|quantanium|agricium|gold|diamond|scrap|cargo|scu|ore|gas)/.test(lower)
    ) {
      return 'commodity';
    }
    return 'other';
  }
}

// ==================== Azure Vision response typing ====================

interface AzureVisionLine {
  text?: string;
}

interface AzureVisionBlock {
  lines?: AzureVisionLine[];
}

interface AzureVisionResponse {
  readResult?: {
    blocks?: AzureVisionBlock[];
  };
}

// Singleton for DI consistency with other services.
let lootOcrServiceInstance: LootOcrService | null = null;

export function getLootOcrService(): LootOcrService {
  return (lootOcrServiceInstance ??= new LootOcrService());
}

