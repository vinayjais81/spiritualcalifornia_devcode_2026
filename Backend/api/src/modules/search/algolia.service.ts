import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { algoliasearch, SearchClient } from 'algoliasearch';

export interface GuideSearchRecord {
  objectID: string;
  displayName: string;
  tagline?: string;
  bio?: string;
  slug: string;
  location?: string;
  city?: string;
  state?: string;
  categories: string[];
  modalities: string[];
  issuesHelped: string[];
  languages: string[];
  averageRating: number;
  totalReviews: number;
  yearsExperience?: number;
  isVerified: boolean;
  avatarUrl?: string;
  sessionPrice60?: number;
  serviceTypes: string[];
}

export interface ProductSearchRecord {
  objectID: string;
  name: string;
  description?: string;
  type: 'DIGITAL' | 'PHYSICAL';
  price: number;
  guideName: string;
  guideSlug: string;
  imageUrl?: string;
  category?: string;
  tags: string[];
}

export interface EventSearchRecord {
  objectID: string;
  title: string;
  type: 'VIRTUAL' | 'IN_PERSON' | 'SOUL_TRAVEL' | 'RETREAT';
  startTime: number; // Unix timestamp for filtering
  location?: string;
  guideName: string;
  guideSlug: string;
  price: number;
  spotsLeft: number;
  imageUrl?: string;
}

@Injectable()
export class AlgoliaService implements OnModuleInit {
  private client: SearchClient;
  private readonly logger = new Logger(AlgoliaService.name);
  readonly guidesIndex: string;
  readonly productsIndex: string;
  readonly eventsIndex: string;

  constructor(private readonly config: ConfigService) {
    const appId = this.config.get<string>('ALGOLIA_APP_ID')!;
    const adminKey = this.config.get<string>('ALGOLIA_ADMIN_API_KEY')!;
    this.client = algoliasearch(appId, adminKey);
    this.guidesIndex = this.config.get('ALGOLIA_GUIDES_INDEX', 'guides');
    this.productsIndex = this.config.get('ALGOLIA_PRODUCTS_INDEX', 'products');
    this.eventsIndex = this.config.get('ALGOLIA_EVENTS_INDEX', 'events');
  }

  async onModuleInit() {
    try {
      // Configure searchable attributes and facets
      await this.client.setSettings({
        indexName: this.guidesIndex,
        indexSettings: {
          searchableAttributes: ['displayName', 'tagline', 'bio', 'categories', 'modalities', 'issuesHelped', 'location'],
          attributesForFaceting: ['filterOnly(isVerified)', 'categories', 'modalities', 'serviceTypes', 'languages', 'state'],
          customRanking: ['desc(averageRating)', 'desc(totalReviews)'],
        },
      });
      await this.client.setSettings({
        indexName: this.productsIndex,
        indexSettings: {
          searchableAttributes: ['name', 'description', 'guideName', 'category', 'tags'],
          attributesForFaceting: ['type', 'category', 'filterOnly(price)'],
          customRanking: ['desc(price)'],
        },
      });
      await this.client.setSettings({
        indexName: this.eventsIndex,
        indexSettings: {
          searchableAttributes: ['title', 'guideName', 'location'],
          attributesForFaceting: ['type', 'filterOnly(startTime)'],
          customRanking: ['asc(startTime)'],
        },
      });
      this.logger.log('Algolia indices configured');
    } catch (err: any) {
      this.logger.warn(`Algolia init skipped: ${err.message}`);
    }
  }

  // ─── Index Operations ──────────────────────────────────────────────────────

  async indexGuide(record: GuideSearchRecord) {
    try {
      await this.client.saveObject({ indexName: this.guidesIndex, body: record });
      this.logger.debug(`Indexed guide: ${record.objectID}`);
    } catch (err: any) {
      this.logger.error(`Failed to index guide: ${err.message}`);
    }
  }

  async removeGuide(objectID: string) {
    try {
      await this.client.deleteObject({ indexName: this.guidesIndex, objectID });
    } catch (err: any) {
      this.logger.error(`Failed to remove guide: ${err.message}`);
    }
  }

  async indexProduct(record: ProductSearchRecord) {
    try {
      await this.client.saveObject({ indexName: this.productsIndex, body: record });
    } catch (err: any) {
      this.logger.error(`Failed to index product: ${err.message}`);
    }
  }

  async removeProduct(objectID: string) {
    try {
      await this.client.deleteObject({ indexName: this.productsIndex, objectID });
    } catch (err: any) {
      this.logger.error(`Failed to remove product: ${err.message}`);
    }
  }

  async indexEvent(record: EventSearchRecord) {
    try {
      await this.client.saveObject({ indexName: this.eventsIndex, body: record });
    } catch (err: any) {
      this.logger.error(`Failed to index event: ${err.message}`);
    }
  }

  async removeEvent(objectID: string) {
    try {
      await this.client.deleteObject({ indexName: this.eventsIndex, objectID });
    } catch (err: any) {
      this.logger.error(`Failed to remove event: ${err.message}`);
    }
  }

  // ─── Bulk Indexing ─────────────────────────────────────────────────────────

  async bulkIndexGuides(records: GuideSearchRecord[]) {
    if (!records.length) return;
    try {
      await this.client.saveObjects({ indexName: this.guidesIndex, objects: records as unknown as Record<string, unknown>[] });
      this.logger.log(`Bulk indexed ${records.length} guides`);
    } catch (err: any) {
      this.logger.error(`Bulk index guides failed: ${err.message}`);
    }
  }

  async bulkIndexProducts(records: ProductSearchRecord[]) {
    if (!records.length) return;
    try {
      await this.client.saveObjects({ indexName: this.productsIndex, objects: records as unknown as Record<string, unknown>[] });
      this.logger.log(`Bulk indexed ${records.length} products`);
    } catch (err: any) {
      this.logger.error(`Bulk index products failed: ${err.message}`);
    }
  }

  async bulkIndexEvents(records: EventSearchRecord[]) {
    if (!records.length) return;
    try {
      await this.client.saveObjects({ indexName: this.eventsIndex, objects: records as unknown as Record<string, unknown>[] });
      this.logger.log(`Bulk indexed ${records.length} events`);
    } catch (err: any) {
      this.logger.error(`Bulk index events failed: ${err.message}`);
    }
  }

  // ─── Search (backend-side, for API endpoints) ──────────────────────────────

  async searchGuides(query: string, filters?: string, page = 0, hitsPerPage = 20) {
    return this.client.searchSingleIndex({
      indexName: this.guidesIndex,
      searchParams: { query, filters, page, hitsPerPage },
    });
  }

  async searchProducts(query: string, filters?: string, page = 0, hitsPerPage = 20) {
    return this.client.searchSingleIndex({
      indexName: this.productsIndex,
      searchParams: { query, filters, page, hitsPerPage },
    });
  }

  async searchEvents(query: string, filters?: string, page = 0, hitsPerPage = 20) {
    return this.client.searchSingleIndex({
      indexName: this.eventsIndex,
      searchParams: { query, filters, page, hitsPerPage },
    });
  }

  // ─── Multi-index search ────────────────────────────────────────────────────

  async searchAll(query: string, hitsPerPage = 5) {
    const results = await this.client.search({
      requests: [
        { indexName: this.guidesIndex, query, hitsPerPage },
        { indexName: this.productsIndex, query, hitsPerPage },
        { indexName: this.eventsIndex, query, hitsPerPage },
      ],
    });
    return {
      guides: (results.results[0] as any)?.hits ?? [],
      products: (results.results[1] as any)?.hits ?? [],
      events: (results.results[2] as any)?.hits ?? [],
    };
  }
}
