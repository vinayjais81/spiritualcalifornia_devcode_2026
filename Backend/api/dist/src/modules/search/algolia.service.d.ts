import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    type: 'VIRTUAL' | 'IN_PERSON' | 'SOUL_TRAVEL';
    startTime: number;
    location?: string;
    guideName: string;
    guideSlug: string;
    price: number;
    spotsLeft: number;
    imageUrl?: string;
}
export declare class AlgoliaService implements OnModuleInit {
    private readonly config;
    private client;
    private readonly logger;
    readonly guidesIndex: string;
    readonly productsIndex: string;
    readonly eventsIndex: string;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    indexGuide(record: GuideSearchRecord): Promise<void>;
    removeGuide(objectID: string): Promise<void>;
    indexProduct(record: ProductSearchRecord): Promise<void>;
    removeProduct(objectID: string): Promise<void>;
    indexEvent(record: EventSearchRecord): Promise<void>;
    removeEvent(objectID: string): Promise<void>;
    bulkIndexGuides(records: GuideSearchRecord[]): Promise<void>;
    bulkIndexProducts(records: ProductSearchRecord[]): Promise<void>;
    bulkIndexEvents(records: EventSearchRecord[]): Promise<void>;
    searchGuides(query: string, filters?: string, page?: number, hitsPerPage?: number): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchProducts(query: string, filters?: string, page?: number, hitsPerPage?: number): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchEvents(query: string, filters?: string, page?: number, hitsPerPage?: number): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchAll(query: string, hitsPerPage?: number): Promise<{
        guides: any;
        products: any;
        events: any;
    }>;
}
