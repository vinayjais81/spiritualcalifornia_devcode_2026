import { PrismaService } from '../../database/prisma.service';
import { AlgoliaService } from './algolia.service';
export declare class SearchService {
    private readonly prisma;
    private readonly algolia;
    constructor(prisma: PrismaService, algolia: AlgoliaService);
    searchAll(query: string): Promise<{
        guides: any;
        products: any;
        events: any;
    }>;
    searchGuides(query: string, filters?: string, page?: number): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchProducts(query: string, filters?: string, page?: number): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchEvents(query: string, filters?: string, page?: number): Promise<import("algoliasearch").SearchResponse<unknown>>;
    reindexAll(): Promise<{
        guidesCount: number;
        productsCount: number;
        eventsCount: number;
    }>;
    reindexGuides(): Promise<number>;
    reindexProducts(): Promise<number>;
    reindexEvents(): Promise<number>;
    indexGuide(guideId: string): Promise<void>;
    indexProduct(productId: string): Promise<void>;
}
