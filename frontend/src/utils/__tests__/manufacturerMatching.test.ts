import {
  dedupeManufacturers,
  isSameManufacturer,
  normalizeManufacturer,
} from '@/utils/manufacturerMatching';

describe('manufacturerMatching', () => {
  it('normalizes apostrophe variants and whitespace', () => {
    expect(normalizeManufacturer("  Grey’s   Market  ")).toBe("grey's market");
  });

  it('matches apostrophe variants as the same manufacturer', () => {
    expect(isSameManufacturer("Grey's Market", 'Greys Market')).toBe(true);
    expect(isSameManufacturer("Grey’s Market", "grey's market")).toBe(true);
  });

  it('does not match different manufacturers', () => {
    expect(isSameManufacturer('Greycat', 'Anvil')).toBe(false);
  });

  it('deduplicates canonical manufacturer duplicates', () => {
    expect(
      dedupeManufacturers(["Grey's Market", 'Greys Market', 'ANVIL', 'Anvil']).sort((a, b) =>
        a.localeCompare(b)
      )
    ).toEqual(['Anvil', "Grey's Market"]);
  });
});
