import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class CacheService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private redis;
    private readonly logger;
    private readonly enabled;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    delPattern(pattern: string): Promise<void>;
    getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds?: number): Promise<T>;
    static keys: {
        guideProfile: (slug: string) => string;
        guideCategories: () => string;
        product: (id: string) => string;
        productsList: (page: number) => string;
        homeData: () => string;
        shippingMethods: () => string;
        taxRates: () => string;
        eventsList: (page: number) => string;
        toursList: (page: number) => string;
    };
}
