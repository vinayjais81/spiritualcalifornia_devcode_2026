import { Test } from '@nestjs/testing';
import { GuidesService } from './guides.service';
import { PrismaService } from '../../database/prisma.service';
import { UploadService } from '../upload/upload.service';
import { ServicesService } from '../services/services.service';
import { EventsService } from '../events/events.service';
import { ProductsService } from '../products/products.service';
import { ReviewsService } from '../reviews/reviews.service';
import { BlogService } from '../blog/blog.service';

// Cover for the practitioners-directory defect:
//   1. Filtering by "Reiki" returned 1 guide and excluded Maya Williams, a
//      Reiki Master — because the filter only looked at GuideProfile.modalities,
//      which is `[]` for every seeded/category-onboarded practitioner. Her
//      modalities live as subcategories (reiki, energy-healing, sound-healing).
//   2. The Featured strip ran its own hardcoded query and so ignored the
//      filter entirely, showing Acupuncture/Tibetan Meditation/Yoga guides
//      while the Reiki filter was active.

describe('GuidesService.listPublic — modality filter and featured', () => {
  let service: GuidesService;
  let findMany: jest.Mock;
  let count: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);
    count = jest.fn().mockResolvedValue(0);

    const stub = {} as any;
    const moduleRef = await Test.createTestingModule({
      providers: [
        GuidesService,
        { provide: PrismaService, useValue: { guideProfile: { findMany, count } } },
        { provide: UploadService, useValue: stub },
        { provide: ServicesService, useValue: stub },
        { provide: EventsService, useValue: stub },
        { provide: ProductsService, useValue: stub },
        { provide: ReviewsService, useValue: stub },
        { provide: BlogService, useValue: stub },
      ],
    }).compile();

    service = moduleRef.get(GuidesService);
  });

  /** The listing query is the first findMany call; featured is the third. */
  const wheres = () => findMany.mock.calls.map((c) => c[0].where);

  describe('modality filter', () => {
    it('matches subcategory name and slug as well as the modalities array', async () => {
      await service.listPublic({ modality: 'Reiki' });

      const or = wheres()[0].OR;
      expect(or).toEqual([
        { modalities: { has: 'Reiki' } },
        { categories: { some: { subcategory: { name: { contains: 'Reiki', mode: 'insensitive' } } } } },
        { categories: { some: { subcategory: { slug: 'reiki' } } } },
      ]);
    });

    it('slugifies multi-word modalities to match seeded subcategory slugs', async () => {
      await service.listPublic({ modality: 'Sound Healing' });
      expect(wheres()[0].OR[2]).toEqual({
        categories: { some: { subcategory: { slug: 'sound-healing' } } },
      });
    });

    it('uses contains so family-level chips are not permanently empty', async () => {
      // 'Coaching' must reach 'Career Coaching' etc; `equals` returned nothing.
      for (const chip of ['Coaching', 'Ayurvedic']) {
        findMany.mockClear();
        await service.listPublic({ modality: chip });
        expect(wheres()[0].OR[1]).toEqual({
          categories: { some: { subcategory: { name: { contains: chip, mode: 'insensitive' } } } },
        });
      }
    });

    // `contains` is necessary but not sufficient: the chip value has to be a
    // real substring of the subcategory name. 'Ayurveda' is NOT a substring of
    // 'Ayurvedic Nutrition' (they diverge at the 8th character), which is why
    // that chip still returned 0 after the filter fix and why the frontend now
    // sends 'Ayurvedic'. This pins the reasoning so the chip list isn't
    // "tidied" back to the prettier word.
    it('documents which chip values actually match the seeded taxonomy', () => {
      const SUBCATEGORIES = [
        'Meditation', 'Hypnotherapy', 'NLP', 'Mindfulness Coaching', 'Breathwork',
        'Yoga', 'Reiki', 'QiGong', 'Acupuncture', 'Sound Healing', 'Energy Healing',
        'Career Coaching', 'Relationship Coaching', 'Executive Coaching',
        'Purpose Coaching', 'Ayurvedic Nutrition',
      ];
      const matches = (chip: string) =>
        SUBCATEGORIES.some((s) => s.toLowerCase().includes(chip.toLowerCase()));

      // Values the practitioners page actually sends.
      for (const chip of [
        'Sound Healing', 'Reiki', 'Breathwork', 'Qigong',
        'Meditation', 'Ayurvedic', 'Yoga', 'Coaching',
      ]) {
        expect({ chip, matches: matches(chip) }).toEqual({ chip, matches: true });
      }

      // The old value, kept as a guard against regressing the label to the value.
      expect(matches('Ayurveda')).toBe(false);
    });

    it('applies no modality constraint for "all" or absent', async () => {
      await service.listPublic({ modality: 'all' });
      expect(wheres()[0].OR).toBeUndefined();

      findMany.mockClear();
      await service.listPublic({});
      expect(wheres()[0].OR).toBeUndefined();
    });

    it('keeps the public visibility gate alongside the filter', async () => {
      await service.listPublic({ modality: 'Reiki' });
      expect(wheres()[0]).toMatchObject({
        isPublished: true,
        isVerified: true,
        user: { isActive: true },
      });
    });
  });

  describe('featured strip', () => {
    it('inherits the active filter instead of running its own query', async () => {
      await service.listPublic({ modality: 'Reiki' });

      const featuredWhere = wheres()[1];
      expect(featuredWhere.isFeatured).toBe(true);
      // The regression: this used to be absent, so Acupuncture/Yoga guides
      // showed under "Featured" with the Reiki filter on.
      expect(featuredWhere.OR).toEqual(wheres()[0].OR);
    });

    it('inherits minRating too', async () => {
      await service.listPublic({ minRating: 4.5 });
      expect(wheres()[1]).toMatchObject({
        isFeatured: true,
        averageRating: { gte: 4.5 },
      });
    });

    it('does not auto-fill to 3 while a filter is active', async () => {
      // Featured returns fewer than 3 (mock returns []), but padding under a
      // filter would put non-matching or duplicate guides under "Featured".
      await service.listPublic({ modality: 'Reiki' });
      expect(findMany).toHaveBeenCalledTimes(2); // listing + featured, no filler
    });

    it('still auto-fills on the unfiltered view', async () => {
      await service.listPublic({});
      expect(findMany).toHaveBeenCalledTimes(3); // listing + featured + filler
      expect(wheres()[2]).toMatchObject({ isFeatured: false });
    });
  });

  describe('displayed modalities', () => {
    it('unions stored modalities with subcategory names, deduped', async () => {
      findMany
        .mockResolvedValueOnce([
          {
            id: 'g1',
            displayName: 'Maya Williams, Reiki Master',
            modalities: [],
            categories: [
              { subcategory: { name: 'Reiki' } },
              { subcategory: { name: 'Energy Healing' } },
              { subcategory: { name: 'Sound Healing' } },
            ],
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await service.listPublic({ modality: 'Reiki' });

      // Previously `[]`, so her card rendered no modality tag even when she
      // matched the Reiki filter.
      expect(res.guides[0].modalities).toEqual(['Reiki', 'Energy Healing', 'Sound Healing']);
    });

    it("puts the guide's own wording first and drops case-duplicates", async () => {
      findMany
        .mockResolvedValueOnce([
          {
            id: 'g2',
            modalities: ['Breathwork', 'Somatic Healing'],
            categories: [{ subcategory: { name: 'breathwork' } }, { subcategory: { name: 'Reiki' } }],
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await service.listPublic({});
      expect(res.guides[0].modalities).toEqual(['Breathwork', 'Somatic Healing', 'Reiki']);
    });

    it('tolerates a guide with neither modalities nor categories', async () => {
      findMany
        .mockResolvedValueOnce([{ id: 'g3' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await service.listPublic({});
      expect(res.guides[0].modalities).toEqual([]);
    });
  });
});
