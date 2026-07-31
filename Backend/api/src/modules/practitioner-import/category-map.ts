/**
 * Sheet name → platform taxonomy.
 *
 * The client's list is organised by modality, one sheet each, and those names
 * don't match our categories. Five had no home at all until the Phase 0
 * migration added them (20260731120000_practitioner_import_taxonomy).
 *
 * Mapping here rather than in the database keeps a bad guess out of the
 * taxonomy: an unmapped sheet imports with no category and is reported, which
 * is recoverable. A wrongly-mapped one is not.
 *
 * See docs/practitioner-import-invite-strategy.md §6.
 */

export interface CategoryMapping {
  categorySlug: string;
  subcategorySlug: string;
  /**
   * Some sheets legitimately split. The Doulas sheet mixes birth and
   * end-of-life practitioners, which belong under different categories, so the
   * row's own modality text decides.
   */
  splitOn?: Array<{
    test: RegExp;
    categorySlug: string;
    subcategorySlug: string;
  }>;
}

const SHEET_MAP: Record<string, CategoryMapping> = {
  'somatic healers': { categorySlug: 'body-healing', subcategorySlug: 'somatic-therapy' },
  'herbalists & nutritionists': { categorySlug: 'nutrition-food', subcategorySlug: 'herbal-medicine' },
  'energy healers': { categorySlug: 'body-healing', subcategorySlug: 'energy-healing' },
  'life coaches': { categorySlug: 'life-coaching', subcategorySlug: 'purpose-coaching' },
  'alternative medicine': { categorySlug: 'integrative-health', subcategorySlug: 'naturopathy' },
  'indigenous & shamanic medicine': { categorySlug: 'soul-spirit', subcategorySlug: 'shamanism' },
  'ayurvedic practitioners': { categorySlug: 'nutrition-food', subcategorySlug: 'ayurvedic-nutrition' },
  'traditional chinese medicine': { categorySlug: 'body-healing', subcategorySlug: 'acupuncture' },
  hypnotherapists: { categorySlug: 'mind-healing', subcategorySlug: 'hypnotherapy' },
  'tibetan medicine': { categorySlug: 'integrative-health', subcategorySlug: 'tibetan-medicine' },
  'plant medicine & integration': { categorySlug: 'soul-spirit', subcategorySlug: 'plant-medicine-integration' },
  'massage & bodywork': { categorySlug: 'body-healing', subcategorySlug: 'massage-bodywork' },

  // Sheets whose rows don't all belong in one place.
  'yoga & meditation teachers': {
    categorySlug: 'body-healing',
    subcategorySlug: 'yoga',
    splitOn: [
      { test: /meditat|mindful|dharma|vipassana|insight/i, categorySlug: 'mind-healing', subcategorySlug: 'meditation' },
    ],
  },
  'sound healing & breathwork': {
    categorySlug: 'body-healing',
    subcategorySlug: 'sound-healing',
    splitOn: [
      { test: /breath|pranayama|holotropic|rebirth/i, categorySlug: 'mind-healing', subcategorySlug: 'breathwork' },
    ],
  },
  'doulas (birth & death)': {
    categorySlug: 'family-children',
    subcategorySlug: 'birth-doula',
    splitOn: [
      {
        test: /death|end[- ]of[- ]life|hospice|dying|palliative/i,
        categorySlug: 'soul-spirit',
        subcategorySlug: 'end-of-life-doula',
      },
    ],
  },
};

/**
 * Resolve a sheet + the row's own modality text to a category/subcategory pair.
 * Returns null when the sheet isn't recognised — the caller records that as an
 * unmapped row rather than inventing a category.
 */
export function resolveCategory(
  sheetName: string,
  modalityText?: string | null,
): { categorySlug: string; subcategorySlug: string } | null {
  const mapping = SHEET_MAP[(sheetName || '').trim().toLowerCase()];
  if (!mapping) return null;

  if (mapping.splitOn && modalityText) {
    const branch = mapping.splitOn.find((s) => s.test.test(modalityText));
    if (branch) {
      return { categorySlug: branch.categorySlug, subcategorySlug: branch.subcategorySlug };
    }
  }
  return { categorySlug: mapping.categorySlug, subcategorySlug: mapping.subcategorySlug };
}

export function knownSheetNames(): string[] {
  return Object.keys(SHEET_MAP);
}
