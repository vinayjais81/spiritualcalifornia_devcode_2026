"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AlgoliaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlgoliaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const algoliasearch_1 = require("algoliasearch");
let AlgoliaService = AlgoliaService_1 = class AlgoliaService {
    config;
    client;
    logger = new common_1.Logger(AlgoliaService_1.name);
    guidesIndex;
    productsIndex;
    eventsIndex;
    constructor(config) {
        this.config = config;
        const appId = this.config.get('ALGOLIA_APP_ID');
        const adminKey = this.config.get('ALGOLIA_ADMIN_API_KEY');
        this.client = (0, algoliasearch_1.algoliasearch)(appId, adminKey);
        this.guidesIndex = this.config.get('ALGOLIA_GUIDES_INDEX', 'guides');
        this.productsIndex = this.config.get('ALGOLIA_PRODUCTS_INDEX', 'products');
        this.eventsIndex = this.config.get('ALGOLIA_EVENTS_INDEX', 'events');
    }
    async onModuleInit() {
        try {
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
        }
        catch (err) {
            this.logger.warn(`Algolia init skipped: ${err.message}`);
        }
    }
    async indexGuide(record) {
        try {
            await this.client.saveObject({ indexName: this.guidesIndex, body: record });
            this.logger.debug(`Indexed guide: ${record.objectID}`);
        }
        catch (err) {
            this.logger.error(`Failed to index guide: ${err.message}`);
        }
    }
    async removeGuide(objectID) {
        try {
            await this.client.deleteObject({ indexName: this.guidesIndex, objectID });
        }
        catch (err) {
            this.logger.error(`Failed to remove guide: ${err.message}`);
        }
    }
    async indexProduct(record) {
        try {
            await this.client.saveObject({ indexName: this.productsIndex, body: record });
        }
        catch (err) {
            this.logger.error(`Failed to index product: ${err.message}`);
        }
    }
    async removeProduct(objectID) {
        try {
            await this.client.deleteObject({ indexName: this.productsIndex, objectID });
        }
        catch (err) {
            this.logger.error(`Failed to remove product: ${err.message}`);
        }
    }
    async indexEvent(record) {
        try {
            await this.client.saveObject({ indexName: this.eventsIndex, body: record });
        }
        catch (err) {
            this.logger.error(`Failed to index event: ${err.message}`);
        }
    }
    async removeEvent(objectID) {
        try {
            await this.client.deleteObject({ indexName: this.eventsIndex, objectID });
        }
        catch (err) {
            this.logger.error(`Failed to remove event: ${err.message}`);
        }
    }
    async bulkIndexGuides(records) {
        if (!records.length)
            return;
        try {
            await this.client.saveObjects({ indexName: this.guidesIndex, objects: records });
            this.logger.log(`Bulk indexed ${records.length} guides`);
        }
        catch (err) {
            this.logger.error(`Bulk index guides failed: ${err.message}`);
        }
    }
    async bulkIndexProducts(records) {
        if (!records.length)
            return;
        try {
            await this.client.saveObjects({ indexName: this.productsIndex, objects: records });
            this.logger.log(`Bulk indexed ${records.length} products`);
        }
        catch (err) {
            this.logger.error(`Bulk index products failed: ${err.message}`);
        }
    }
    async bulkIndexEvents(records) {
        if (!records.length)
            return;
        try {
            await this.client.saveObjects({ indexName: this.eventsIndex, objects: records });
            this.logger.log(`Bulk indexed ${records.length} events`);
        }
        catch (err) {
            this.logger.error(`Bulk index events failed: ${err.message}`);
        }
    }
    async searchGuides(query, filters, page = 0, hitsPerPage = 20) {
        return this.client.searchSingleIndex({
            indexName: this.guidesIndex,
            searchParams: { query, filters, page, hitsPerPage },
        });
    }
    async searchProducts(query, filters, page = 0, hitsPerPage = 20) {
        return this.client.searchSingleIndex({
            indexName: this.productsIndex,
            searchParams: { query, filters, page, hitsPerPage },
        });
    }
    async searchEvents(query, filters, page = 0, hitsPerPage = 20) {
        return this.client.searchSingleIndex({
            indexName: this.eventsIndex,
            searchParams: { query, filters, page, hitsPerPage },
        });
    }
    async searchAll(query, hitsPerPage = 5) {
        const results = await this.client.search({
            requests: [
                { indexName: this.guidesIndex, query, hitsPerPage },
                { indexName: this.productsIndex, query, hitsPerPage },
                { indexName: this.eventsIndex, query, hitsPerPage },
            ],
        });
        return {
            guides: results.results[0]?.hits ?? [],
            products: results.results[1]?.hits ?? [],
            events: results.results[2]?.hits ?? [],
        };
    }
};
exports.AlgoliaService = AlgoliaService;
exports.AlgoliaService = AlgoliaService = AlgoliaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AlgoliaService);
//# sourceMappingURL=algolia.service.js.map