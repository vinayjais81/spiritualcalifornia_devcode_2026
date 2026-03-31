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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const search_service_1 = require("./search.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const client_1 = require("@prisma/client");
let SearchController = class SearchController {
    searchService;
    constructor(searchService) {
        this.searchService = searchService;
    }
    searchAll(q) {
        return this.searchService.searchAll(q || '');
    }
    searchGuides(q, filters, page) {
        return this.searchService.searchGuides(q || '', filters, Number(page) || 0);
    }
    searchProducts(q, filters, page) {
        return this.searchService.searchProducts(q || '', filters, Number(page) || 0);
    }
    searchEvents(q, filters, page) {
        return this.searchService.searchEvents(q || '', filters, Number(page) || 0);
    }
    reindexAll() {
        return this.searchService.reindexAll();
    }
};
exports.SearchController = SearchController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Search across guides, products, and events' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: true, description: 'Search query' }),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SearchController.prototype, "searchAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('guides'),
    (0, swagger_1.ApiOperation)({ summary: 'Search guides with filters' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'filters', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('filters')),
    __param(2, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SearchController.prototype, "searchGuides", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('products'),
    (0, swagger_1.ApiOperation)({ summary: 'Search products with filters' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'filters', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('filters')),
    __param(2, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SearchController.prototype, "searchProducts", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('events'),
    (0, swagger_1.ApiOperation)({ summary: 'Search events with filters' }),
    (0, swagger_1.ApiQuery)({ name: 'q', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'filters', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false }),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('filters')),
    __param(2, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SearchController.prototype, "searchEvents", null);
__decorate([
    (0, common_1.Post)('reindex'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Reindex all data to Algolia (admin only)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SearchController.prototype, "reindexAll", null);
exports.SearchController = SearchController = __decorate([
    (0, swagger_1.ApiTags)('Search'),
    (0, common_1.Controller)('search'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [search_service_1.SearchService])
], SearchController);
//# sourceMappingURL=search.controller.js.map