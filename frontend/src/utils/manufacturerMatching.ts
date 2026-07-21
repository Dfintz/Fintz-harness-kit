const APOSTROPHE_VARIANTS_REGEX = /[\u2018\u2019`´]/g;

export function normalizeManufacturer(value?: string): string {
  return (value ?? '')
    .normalize('NFKC')
    .replace(APOSTROPHE_VARIANTS_REGEX, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripApostrophes(value: string): string {
  return value.replaceAll("'", '');
}

export function isSameManufacturer(left?: string, right?: string): boolean {
  const normalizedLeft = normalizeManufacturer(left);
  const normalizedRight = normalizeManufacturer(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  // Accept apostrophe-presence variants (e.g. Grey's vs Greys).
  return stripApostrophes(normalizedLeft) === stripApostrophes(normalizedRight);
}

export function dedupeManufacturers(manufacturers: string[]): string[] {
  const canonicalToLabel = new Map<string, string>();

  for (const manufacturer of manufacturers) {
    const display = manufacturer.trim();
    const key = stripApostrophes(normalizeManufacturer(display));
    if (!key) continue;

    const existing = canonicalToLabel.get(key);
    if (!existing || display.localeCompare(existing) < 0) {
      canonicalToLabel.set(key, display);
    }
  }

  return [...canonicalToLabel.values()];
}