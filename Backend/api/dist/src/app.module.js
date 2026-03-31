"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const env_validation_1 = require("./config/env.validation");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const guides_module_1 = require("./modules/guides/guides.module");
const services_module_1 = require("./modules/services/services.module");
const bookings_module_1 = require("./modules/bookings/bookings.module");
const payments_module_1 = require("./modules/payments/payments.module");
const events_module_1 = require("./modules/events/events.module");
const products_module_1 = require("./modules/products/products.module");
const reviews_module_1 = require("./modules/reviews/reviews.module");
const admin_module_1 = require("./modules/admin/admin.module");
const verification_module_1 = require("./modules/verification/verification.module");
const ai_module_1 = require("./modules/ai/ai.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const search_module_1 = require("./modules/search/search.module");
const upload_module_1 = require("./modules/upload/upload.module");
const seekers_module_1 = require("./modules/seekers/seekers.module");
const contact_module_1 = require("./modules/contact/contact.module");
const blog_module_1 = require("./modules/blog/blog.module");
const home_module_1 = require("./modules/home/home.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                validate: env_validation_1.validateEnv,
                envFilePath: '.env',
            }),
            throttler_1.ThrottlerModule.forRoot([
                { name: 'short', ttl: 1000, limit: 10 },
                { name: 'medium', ttl: 60000, limit: 100 },
                { name: 'long', ttl: 3600000, limit: 1000 },
            ]),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            guides_module_1.GuidesModule,
            services_module_1.ServicesModule,
            bookings_module_1.BookingsModule,
            payments_module_1.PaymentsModule,
            events_module_1.EventsModule,
            products_module_1.ProductsModule,
            reviews_module_1.ReviewsModule,
            admin_module_1.AdminModule,
            verification_module_1.VerificationModule,
            ai_module_1.AiModule,
            notifications_module_1.NotificationsModule,
            search_module_1.SearchModule,
            upload_module_1.UploadModule,
            seekers_module_1.SeekersModule,
            contact_module_1.ContactModule,
            blog_module_1.BlogModule,
            home_module_1.HomeModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map