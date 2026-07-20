"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LootOcrService = void 0;
exports.getLootOcrService = getLootOcrService;
const logger_1 = require("../../utils/logger");
class LootOcrService {
    static PROVIDER = 'azure-vision';
    static API_VERSION = '2024-02-01';
    get endpoint() {
        return process.env.AZURE_VISION_ENDPOINT?.replace(/\/+$/, '');
    }
    get apiKey() {
        return process.env.AZURE_VISION_KEY;
    }
    isConfigured() {
        return Boolean(this.endpoint && this.apiKey);
    }
    async extractItems(imageBuffer) {
        if (!this.isConfigured()) {
            logger_1.logger.info('LootOcrService not configured — skipping OCR, manual entry only');
            return { suggestions: [], rawLines: [], provider: LootOcrService.PROVIDER, enabled: false };
        }
        try {
            const url = `${this.endpoint}/computervision/imageanalysis:analyze` +
                `?api-version=${LootOcrService.API_VERSION}&features=read`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                    'Content-Type': 'application/octet-stream',
                },
                body: new Uint8Array(imageBuffer),
            });
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                logger_1.logger.warn('Azure Vision OCR request failed', {
                    status: response.status,
                    body: text.slice(0, 500),
                });
                return { suggestions: [], rawLines: [], provider: LootOcrService.PROVIDER, enabled: true };
            }
            const json = (await response.json());
            const rawLines = this.collectLines(json);
            const suggestions = this.parseLines(rawLines);
            logger_1.logger.info('Loot OCR completed', {
                lines: rawLines.length,
                suggestions: suggestions.length,
            });
            return { suggestions, rawLines, provider: LootOcrService.PROVIDER, enabled: true };
        }
        catch (error) {
            logger_1.logger.error('Loot OCR error', {
                error: error instanceof Error ? error.message : String(error),
            });
            return { suggestions: [], rawLines: [], provider: LootOcrService.PROVIDER, enabled: true };
        }
    }
    collectLines(json) {
        const blocks = json.readResult?.blocks ?? [];
        const lines = [];
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
    parseLines(lines) {
        const suggestions = [];
        for (const original of lines) {
            const line = original.replace(/\s+/g, ' ').trim();
            if (line.length < 3) {
                continue;
            }
            if (/^[\d.,\s]+$/.test(line)) {
                continue;
            }
            let quantity = 1;
            let name = line;
            const leading = name.match(/^x?(\d{1,4})\s*[x×]?\s+(.+)$/i);
            const trailingX = name.match(/^(.+?)\s*[x×]\s*(\d{1,4})$/i);
            const trailingNum = name.match(/^(.+?)\s+(\d{1,4})(?:\s*(?:scu|units?|x))?$/i);
            if (leading && leading[2]) {
                quantity = Number.parseInt(leading[1], 10);
                name = leading[2];
            }
            else if (trailingX && trailingX[1]) {
                name = trailingX[1];
                quantity = Number.parseInt(trailingX[2], 10);
            }
            else if (trailingNum && trailingNum[1] && /[a-z]/i.test(trailingNum[1])) {
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
    guessCategory(name) {
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
        if (/(titanium|laranite|quantanium|agricium|gold|diamond|scrap|cargo|scu|ore|gas)/.test(lower)) {
            return 'commodity';
        }
        return 'other';
    }
}
exports.LootOcrService = LootOcrService;
let lootOcrServiceInstance = null;
function getLootOcrService() {
    return (lootOcrServiceInstance ??= new LootOcrService());
}
//# sourceMappingURL=LootOcrService.js.map