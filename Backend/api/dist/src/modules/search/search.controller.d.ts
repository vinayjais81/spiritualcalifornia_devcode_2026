import { SearchService } from './search.service';
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    searchAll(q: string): Promise<{
        guides: any;
        products: any;
        events: any;
    }>;
    searchGuides(q?: string, filters?: string, page?: string): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchProducts(q?: string, filters?: string, page?: string): Promise<import("algoliasearch").SearchResponse<unknown>>;
    searchEvents(q?: string, filters?: string, page?: string): Promise<import("algoliasearch").SearchResponse<unknown>>;
    reindexAll(): Promise<{
        guidesCount: number;
        productsCount: number;
        eventsCount: number;
    }>;
}
